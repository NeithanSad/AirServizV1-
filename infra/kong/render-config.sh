#!/bin/sh
# =============================================================================
# Renders Kong's declarative config from templates, injecting JWT_SECRET.
#
# Why this exists
# ---------------
# Kong's DB-less declarative config is a static YAML file, so the HS256 secret
# that validates every JWT used to be written literally into it — and therefore
# committed to git, duplicated in kong.yaml and kong.local.yaml, and impossible
# to keep in sync with auth-service by anything other than discipline.
#
# Kong's own answer to this (vault references, `{vault://env/...}`) does NOT
# work for `jwt_secrets.secret` in DB-less mode as of Kong 3.6 — support is
# still an open PR (Kong/kong#14775). Worse, an unresolved reference silently
# degrades the secret to an empty string instead of failing, which would let
# anyone forge a token. That is a fail-OPEN design, so we render the file
# ourselves and fail CLOSED on every check below.
#
# Contract: reads *.template from TEMPLATE_DIR, writes the same name minus
# `.template` into OUTPUT_DIR. Exits non-zero — aborting the whole stack —
# if anything about the secret looks wrong.
# =============================================================================
set -eu

TEMPLATE_DIR="${TEMPLATE_DIR:-/templates}"
OUTPUT_DIR="${OUTPUT_DIR:-/rendered}"
MARKER='__JWT_SECRET__'

# The value this repo shipped with before secrets were externalised. It is
# public (it lived in git), so treat it as compromised and refuse to boot.
LEAKED_PLACEHOLDER='change_me_to_a_real_secret_32chars'

fail() { echo "render-config: ERROR: $*" >&2; exit 1; }

# ── Validate the secret before it touches a file ─────────────────────────────
[ "${JWT_SECRET:-}" != "" ] || fail "JWT_SECRET is empty or unset. Set it in infra/docker-compose/.env (see .env.example)."

[ "$JWT_SECRET" != "$LEAKED_PLACEHOLDER" ] || fail "JWT_SECRET is still the placeholder committed to git. Rotate it: scripts/rotate-secrets.sh"

# HS256 keys shorter than the 256-bit hash output weaken the construction.
secret_len=$(printf '%s' "$JWT_SECRET" | wc -c | tr -d ' ')
[ "$secret_len" -ge 32 ] || fail "JWT_SECRET is $secret_len bytes; 32 is the minimum for HS256."

mkdir -p "$OUTPUT_DIR"

rendered_any=0
for template in "$TEMPLATE_DIR"/*.template; do
  [ -e "$template" ] || fail "no *.template files found in $TEMPLATE_DIR"

  output="$OUTPUT_DIR/$(basename "$template" .template)"

  # Literal substitution via index()/substr(). Deliberately NOT sed or awk's
  # gsub(): both interpret the replacement text, so a secret containing & / \
  # or the delimiter would be silently mangled into a different value.
  awk -v marker="$MARKER" '
    BEGIN { secret = ENVIRON["JWT_SECRET"] }
    {
      line = $0; out = ""
      while ((p = index(line, marker)) > 0) {
        out = out substr(line, 1, p - 1) secret
        line = substr(line, p + length(marker))
      }
      print out line
    }
  ' "$template" > "$output"

  # The check that matters. A substitution that quietly does nothing is exactly
  # how Kong's vault path fails open, so assert the marker is really gone
  # rather than assuming the loop above did its job.
  if grep -q "$MARKER" "$output"; then
    rm -f "$output"
    fail "$MARKER survived substitution in $(basename "$output") — refusing to start Kong with an unauthenticated config."
  fi

  # 0644, no 0640: este contenedor corre como root, pero Kong corre como el
  # usuario `kong` sin privilegios y necesita leer el archivo. Restringir al
  # grupo lo deja ilegible para Kong y el gateway no arranca.
  # No es una concesión real: el volumen lo monta un único contenedor, así que
  # "otros" aquí son los propios procesos de Kong. Cualquiera que pueda leerlo
  # ya tiene ejecución de código dentro de ese contenedor.
  chmod 0644 "$output"
  echo "render-config: rendered $(basename "$output")"
  rendered_any=1
done

[ "$rendered_any" -eq 1 ] || fail "nothing was rendered"
echo "render-config: OK"
