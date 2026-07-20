#!/usr/bin/env bash
# =============================================================================
# Sincroniza el código de autenticación compartido desde libs/auth/ hacia cada
# microservicio.
#
#   bash scripts/sync-shared-auth.sh            # copia (usar tras editar libs/auth)
#   bash scripts/sync-shared-auth.sh --check    # solo verifica; falla si divergen
#
# Por qué se copia en lugar de importarse
# ---------------------------------------
# El contexto de build de Docker es el directorio de cada servicio (ver sus
# Dockerfile: `COPY src ./src`), así que `libs/` no existe al construir la
# imagen. Mover el contexto a la raíz del repo haría que los filtros por ruta
# del CI dejaran de servir: cualquier cambio reconstruiría los seis servicios.
#
# La copia introduce riesgo de divergencia, y es exactamente lo que evita el
# modo --check: CI lo ejecuta y falla si alguien editó una copia en vez del
# original. Duplicación tolerada, pero verificada.
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/libs/auth"

# auth-service queda FUERA a propósito: es el emisor de los tokens, no un
# consumidor, y ya tiene su propio `src/auth/` de dominio con su JwtModule
# configurado. Verificar tokens ajenos no es su trabajo.
SERVICES=(
  booking-service
  catalog-service
  notification-service
  payment-service
  user-service
)

FILES=(
  jwt-auth.guard.ts
  current-user.decorator.ts
  auth.module.ts
)

# Directorio propio, NO `src/auth/`: ese nombre ya lo usa auth-service para su
# módulo de dominio, y una primera versión de este script lo sobrescribió.
TARGET_SUBDIR="shared-auth"

# Marca que identifica un archivo como copia generada. El script se niega a
# pisar cualquier archivo que no la lleve, para que un error en la lista de
# servicios no destruya código escrito a mano.
CANONICAL_MARKER="FUENTE CANÓNICA"

CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

divergent=0
copied=0

for service in "${SERVICES[@]}"; do
  target_dir="$REPO_ROOT/services/$service/src/$TARGET_SUBDIR"

  for file in "${FILES[@]}"; do
    source_file="$SOURCE_DIR/$file"
    target_file="$target_dir/$file"

    [ -f "$source_file" ] || { echo "ERROR: falta el original $source_file" >&2; exit 1; }

    if [ "$CHECK_ONLY" -eq 1 ]; then
      if [ ! -f "$target_file" ]; then
        echo "  ✗ $service/$file — no existe (ejecuta el script sin --check)"
        divergent=1
      elif ! cmp -s "$source_file" "$target_file"; then
        echo "  ✗ $service/$file — DIVERGE de libs/auth/"
        divergent=1
      fi
    else
      # Salvaguarda: nunca pisar un archivo que no sea una copia generada.
      if [ -f "$target_file" ] && ! grep -q "$CANONICAL_MARKER" "$target_file"; then
        echo "ERROR: $target_file existe y NO es una copia generada." >&2
        echo "       Se aborta para no destruir código escrito a mano." >&2
        exit 1
      fi

      mkdir -p "$target_dir"
      if [ ! -f "$target_file" ] || ! cmp -s "$source_file" "$target_file"; then
        cp "$source_file" "$target_file"
        echo "  → $service/src/$TARGET_SUBDIR/$file"
        copied=$((copied + 1))
      fi
    fi
  done
done

echo
if [ "$CHECK_ONLY" -eq 1 ]; then
  if [ "$divergent" -eq 1 ]; then
    echo "❌ Hay copias divergentes. Edita libs/auth/ y ejecuta:"
    echo "     bash scripts/sync-shared-auth.sh"
    exit 1
  fi
  echo "✅ Todas las copias coinciden con libs/auth/"
else
  echo "✅ Sincronizado ($copied archivo(s) actualizado(s))"
fi
