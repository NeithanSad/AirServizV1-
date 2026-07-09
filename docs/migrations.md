# Migraciones TypeORM

Desde el Sprint 7 los servicios con base de datos usan **migraciones versionadas**
en lugar de `synchronize: true`. Cada servicio corre sus migraciones
automáticamente al arrancar (`migrationsRun: true`).

Servicios con BD y migraciones: **auth, booking, catalog, user, payment**
(notification no tiene BD).

## Estructura por servicio

```
src/database/
  data-source.ts          # DataSource para el CLI de TypeORM
  migrations/             # migraciones versionadas (baseline: Init*)
```

Scripts (en el `package.json` de cada servicio):

```bash
npm run migration:generate -- src/database/migrations/NombreDelCambio
npm run migration:run       # aplica pendientes (también corre solo al arrancar)
npm run migration:revert    # revierte la última
```

El CLI toma la conexión de las variables `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS`
(igual que el servicio). Ejemplo local para booking:

```bash
cd services/booking-service
DB_HOST=localhost DB_PORT=5434 DB_NAME=bookings_db \
DB_USER=bookings_admin DB_PASS=change_me npm run migration:run
```

## ⚠️ Reset único al migrar desde synchronize

Tus BDs de desarrollo ya tienen tablas creadas por `synchronize` en sprints
anteriores. La migración baseline (`Init*`) hace `CREATE TABLE`, así que sobre
una BD que ya tiene esas tablas fallaría con *"relation already exists"*.

Haz **una sola vez** un reset de los volúmenes de Postgres (solo contienen datos
demo, que se vuelven a sembrar solos al arrancar):

```bash
cd infra/docker-compose
docker compose down -v          # borra los volúmenes de datos
docker compose up -d postgres-users postgres-bookings postgres-catalog postgres-payments
```

Luego, al iniciar cada servicio, la baseline crea el schema limpio y queda
registrada en la tabla `migrations`. A partir de ahí los cambios de entidades se
versionan con `migration:generate`.

> En entornos nuevos (K8s con volúmenes vacíos, CI) no hay nada que resetear:
> las migraciones crean el schema desde cero.

## Flujo para cambios futuros

1. Modifica la entidad (`*.entity.ts`).
2. `npm run migration:generate -- src/database/migrations/DescripcionDelCambio`
   (contra una BD que refleje el estado anterior).
3. Revisa el SQL generado y commitea la migración.
4. Al desplegar, `migrationsRun: true` la aplica automáticamente.
