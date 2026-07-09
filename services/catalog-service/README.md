# catalog-service

Microservicio de catálogo: CRUD de servicios reales ofrecidos por proveedores.

- **Stack:** NestJS + TypeORM + PostgreSQL (`postgres-catalog`, puerto host 5435)
- **Puerto:** 3004 — Swagger en `http://localhost:3004/api/docs`

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST   | `/services` | Crear servicio (header `x-actor-id` = provider UUID) |
| GET    | `/services?providerId=&category=` | Listar servicios activos |
| GET    | `/services/:id` | Obtener servicio |
| PATCH  | `/services/:id` | Actualizar (solo el dueño) |
| DELETE | `/services/:id` | Desactivar / soft-delete (solo el dueño) |

## Seed

Al arrancar con la tabla vacía se insertan 6 servicios demo ligados a los
proveedores demo de `user-service` (UUIDs fijos compartidos en
`src/services/seed/demo-catalog.seed.ts`).

## Desarrollo local

```
npm install
npm run start:dev
```

Requiere `postgres-catalog` levantado (`infra/docker-compose`).
