# user-service

Microservicio de perfiles de usuario: nombre completo, bio, foto, teléfono y ubicación.

- **Stack:** NestJS + TypeORM + PostgreSQL (comparte `users_db` con auth-service, puerto host 5433)
- **Puerto:** 3005 — Swagger en `http://localhost:3005/api/docs`

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET    | `/profiles?role=PROVIDER` | Listar perfiles (dropdown de proveedores del client-app) |
| GET    | `/profiles/:userId` | Obtener perfil |
| PUT    | `/profiles/:userId` | Crear/actualizar perfil propio (header `x-actor-id`) |

Las fotos son URLs de imágenes libres (randomuser.me) — sin pipeline de subida aún.

## Seed

Al arrancar con la tabla vacía se insertan 3 proveedores demo con UUIDs fijos,
compartidos con el seed de catalog-service
(`src/profiles/seed/demo-profiles.seed.ts`).

## Desarrollo local

```
npm install
npm run start:dev
```

Requiere `postgres-users` levantado (`infra/docker-compose`).
