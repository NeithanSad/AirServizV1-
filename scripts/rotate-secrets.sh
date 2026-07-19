#!/usr/bin/env bash
# =============================================================================
# Rota los secretos de aplicación del entorno local y los propaga a TODOS los
# sitios que deben compartirlos. Ejecutar desde cualquier directorio:
#
#   bash scripts/rotate-secrets.sh
#
# Qué rota
# --------
#   JWT_SECRET             firma los JWT (auth-service) y los valida (Kong)
#   STRIPE_WEBHOOK_SECRET  HMAC del webhook de la pasarela simulada
#
# Ambos son configuración pura: rotarlos solo invalida las sesiones activas.
#
# Qué NO rota, y por qué
# ----------------------
# Las contraseñas de PostgreSQL. `POSTGRES_PASSWORD` solo se aplica cuando el
# contenedor inicializa un volumen de datos VACÍO; cambiarla en el .env con
# volúmenes ya creados no cambia la contraseña dentro de Postgres, solo hace
# que los servicios dejen de poder conectarse.
#
# Se rotan con su propio script, que hace ALTER USER in-situ y no pierde datos
# (requiere el stack levantado, por eso va aparte):
#
#   bash scripts/rotate-db-passwords.sh
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_ENV="$REPO_ROOT/infra/docker-compose/.env"
COMPOSE_ENV_EXAMPLE="$REPO_ROOT/infra/docker-compose/.env.example"
AUTH_ENV="$REPO_ROOT/services/auth-service/.env"
PAYMENT_ENV="$REPO_ROOT/services/payment-service/.env"

# ── Generación ───────────────────────────────────────────────────────────────
# Hex, no base64: 32 bytes de entropía real (256 bits, el tamaño de salida de
# SHA-256, que es lo que HS256 usa) sin caracteres que necesiten escaparse al
# viajar por YAML, .env y sustitución de plantillas.
generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    # Fallback sin openssl (poco probable en Git Bash, pero el script no debe
    # inventarse un secreto débil si falta la herramienta).
    od -An -tx1 -N32 /dev/urandom | tr -d ' \n'
  fi
}

# Inserta o reemplaza `clave=valor` en un archivo .env, preservando el resto.
upsert_env() {
  local file="$1" key="$2" value="$3"
  mkdir -p "$(dirname "$file")"
  [ -f "$file" ] || : > "$file"

  # El valor se pasa por el entorno, no por -v: awk interpreta las secuencias
  # de escape en los argumentos -v y podría alterar silenciosamente el secreto.
  UPSERT_KEY="$key" UPSERT_VALUE="$value" awk '
    BEGIN { key = ENVIRON["UPSERT_KEY"]; value = ENVIRON["UPSERT_VALUE"]; seen = 0 }
    $0 ~ "^" key "=" { print key "=" value; seen = 1; next }
    { print }
    END { if (!seen) print key "=" value }
  ' "$file" > "$file.tmp"
  mv "$file.tmp" "$file"
}

# ── Bootstrap ────────────────────────────────────────────────────────────────
if [ ! -f "$COMPOSE_ENV" ]; then
  echo "· $COMPOSE_ENV no existe — creándolo desde .env.example"
  cp "$COMPOSE_ENV_EXAMPLE" "$COMPOSE_ENV"
fi

# Las contraseñas de BD se siembran con valores fuertes SOLO si aún no existen,
# para no romper instalaciones cuyos volúmenes ya están inicializados.
seeded_db_password=0
for db_var in POSTGRES_USERS_PASSWORD POSTGRES_BOOKINGS_PASSWORD \
              POSTGRES_CATALOG_PASSWORD POSTGRES_PAYMENTS_PASSWORD; do
  if ! grep -qE "^${db_var}=.+" "$COMPOSE_ENV" 2>/dev/null; then
    upsert_env "$COMPOSE_ENV" "$db_var" "$(generate_secret)"
    echo "· sembrada $db_var (nueva)"
    seeded_db_password=1
  fi
done

# ── Rotación ─────────────────────────────────────────────────────────────────
JWT_SECRET_NEW="$(generate_secret)"
STRIPE_WEBHOOK_SECRET_NEW="whsec_sim_$(generate_secret)"

upsert_env "$COMPOSE_ENV" JWT_SECRET "$JWT_SECRET_NEW"
upsert_env "$COMPOSE_ENV" STRIPE_WEBHOOK_SECRET "$STRIPE_WEBHOOK_SECRET_NEW"

# auth-service y payment-service corren también fuera de Docker
# (`npm run start:dev`) leyendo su propio .env. Son los únicos puntos donde un
# secreto se duplica por necesidad, así que se escriben en este mismo paso —
# nunca a mano.
upsert_env "$AUTH_ENV" JWT_SECRET "$JWT_SECRET_NEW"
upsert_env "$PAYMENT_ENV" STRIPE_WEBHOOK_SECRET "$STRIPE_WEBHOOK_SECRET_NEW"

echo
echo "✅ JWT_SECRET y STRIPE_WEBHOOK_SECRET rotados."
echo "   · infra/docker-compose/.env      (Kong + todos los servicios en Docker)"
echo "   · services/auth-service/.env     (auth-service en host)"
echo "   · services/payment-service/.env  (payment-service en host)"
echo
if [ "$seeded_db_password" -eq 1 ]; then
  echo "⚠️  Se generaron contraseñas de PostgreSQL nuevas. Si YA tenías volúmenes"
  echo "    creados, los servicios no podrán conectarse: pon los valores antiguos"
  echo "    en el .env o ejecuta 'docker compose --profile services down -v'"
  echo "    (⚠️ borra los datos de desarrollo) para reinicializar."
  echo
fi
echo "Siguiente paso — recrear los contenedores que leen estos secretos:"
echo "  cd infra/docker-compose"
echo "  docker compose --profile services up -d --force-recreate kong-config-init kong auth-service payment-service"
echo
echo "Las sesiones abiertas quedan invalidadas: hay que volver a iniciar sesión."
