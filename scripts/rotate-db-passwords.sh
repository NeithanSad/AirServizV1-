#!/usr/bin/env bash
# =============================================================================
# Rota las contraseñas de las 4 instancias PostgreSQL SIN destruir datos.
#
#   bash scripts/rotate-db-passwords.sh
#
# Requiere que los contenedores postgres-* estén levantados.
#
# Por qué existe (y no basta con editar el .env)
# ----------------------------------------------
# `POSTGRES_PASSWORD` solo se aplica cuando el contenedor inicializa un volumen
# de datos VACÍO. Con volúmenes ya creados, cambiarlo en el .env no cambia nada
# dentro de Postgres: solo hace que los servicios dejen de poder conectarse. La
# vía "oficial" sería `docker compose down -v`, que borra los datos de
# desarrollo. Este script hace ALTER USER dentro de cada instancia, dejando
# volúmenes y datos intactos.
#
# Por qué la verificación se hace desde OTRO contenedor
# -----------------------------------------------------
# El pg_hba.conf por defecto de la imagen oficial es:
#
#     local  all all                    trust
#     host   all all 127.0.0.1/32       trust
#     host   all all all   scram-sha-256
#
# Es decir: el socket local y localhost NO piden contraseña; solo se exige a
# las conexiones que llegan desde otro host de la red. Comprobar la contraseña
# con `docker exec ... psql` (socket) pasa SIEMPRE, tenga el valor que tenga —
# no verifica nada. Por eso las comprobaciones se hacen desde un contenedor
# efímero conectado a la red del stack, que es la ruta que usan los servicios.
#
# Ese mismo `trust` por socket es lo que permite rotar sin conocer la
# contraseña actual. Nota de seguridad: implica que cualquiera con ejecución
# dentro del contenedor entra sin contraseña — aceptable en desarrollo, a
# endurecer si algún día estas bases se exponen fuera de la red del stack.
# =============================================================================
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/infra/docker-compose/.env"

# Nombre de la red que crea docker compose (prefijo = nombre del directorio).
NET="${AIRSERVIZ_NET:-docker-compose_airserviz-net}"

# Contraseña que se considera "vieja" al comprobar que dejó de valer. Se puede
# sobreescribir si el entorno venía de otro valor.
OLD="${OLD_DB_PASSWORD:-change_me}"

upsert_env() {
  local file="$1" key="$2" value="$3"
  UPSERT_KEY="$key" UPSERT_VALUE="$value" awk '
    BEGIN { key = ENVIRON["UPSERT_KEY"]; value = ENVIRON["UPSERT_VALUE"]; seen = 0 }
    $0 ~ "^" key "=" { print key "=" value; seen = 1; next }
    { print }
    END { if (!seen) print key "=" value }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
}

probe_over_network() { # <host> <user> <db> <password>
  docker run --rm --network "$NET" -e PGPASSWORD="$4" postgres:15-alpine \
    psql -h "$1" -U "$2" -d "$3" -qtAc "SELECT 'ok'" 2>&1 | tr -d '\r '
}

TARGETS="
postgres-users:users_admin:users_db:POSTGRES_USERS_PASSWORD
postgres-bookings:bookings_admin:bookings_db:POSTGRES_BOOKINGS_PASSWORD
postgres-catalog:catalog_admin:catalog_db:POSTGRES_CATALOG_PASSWORD
postgres-payments:payments_admin:payments_db:POSTGRES_PAYMENTS_PASSWORD
"

if ! docker network inspect "$NET" >/dev/null 2>&1; then
  echo "ERROR: no existe la red '$NET'. Levanta el stack primero, o define AIRSERVIZ_NET." >&2
  exit 1
fi

fails=0
for spec in $TARGETS; do
  IFS=: read -r container user db var <<< "$spec"
  new=$(openssl rand -hex 32)   # hex: sin comillas ni escapes que romper en SQL

  # 1. Rotar (por socket, que es `trust`: no hace falta la contraseña actual)
  if ! out=$(docker exec "$container" psql -U "$user" -d "$db" \
             -qtAc "ALTER USER $user WITH PASSWORD '$new'" 2>&1); then
    echo "  ❌ $container: ALTER USER falló — $out"
    fails=$((fails+1)); continue
  fi

  # 2. La nueva DEBE autenticar por red
  if [ "$(probe_over_network "$container" "$user" "$db" "$new")" != "ok" ]; then
    echo "  ❌ $container: la contraseña nueva no autentica por red"
    fails=$((fails+1)); continue
  fi

  # 3. La vieja NO debe autenticar por red — la prueba real de la rotación
  if [ "$(probe_over_network "$container" "$user" "$db" "$OLD")" = "ok" ]; then
    echo "  ❌ $container: la contraseña anterior SIGUE siendo válida"
    fails=$((fails+1)); continue
  fi

  # 4. Solo tras verificar se persiste, para que un fallo deje el entorno
  #    funcionando con la contraseña anterior en lugar de a medias.
  upsert_env "$ENV_FILE" "$var" "$new"
  echo "  ✅ $container — rotada · nueva verificada · anterior rechazada · .env actualizado"
done

echo
if [ "$fails" -eq 0 ]; then
  echo "Las 4 contraseñas rotadas y verificadas, sin pérdida de datos."
  echo
  echo "Siguiente paso — recrear los servicios para que tomen las nuevas:"
  echo "  cd infra/docker-compose && docker compose --profile services up -d --force-recreate"
else
  echo "$fails fallo(s) — revisa arriba. El .env solo se actualizó para las que sí pasaron."
fi
exit "$fails"
