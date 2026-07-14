# AirServiz - Proyecto Integrador

Marketplace de servicios locales bajo demanda.
Arquitectura: Event-Driven Microservices (Docker + Kubernetes + Kong + Kafka + Redis + AWS Lambda)

## Estructura
- apps/        -> Frontends (cliente, proveedor, admin)
- services/     -> Microservicios backend
- libs/         -> Código compartido (contratos de eventos, DTOs)
- infra/        -> docker-compose, manifiestos k8s, config Kong, observabilidad
- docs/         -> ADRs y contratos de API

## Levantar entorno local

**Todo en un solo comando** (infra + los 6 microservicios como contenedores):
```
cd infra\docker-compose
docker compose --profile services up -d
```

Sin `--profile services` solo se levanta la infraestructura (Postgres x4, Kafka,
Redis, Kong) — útil si prefieres correr los microservicios tú mismo con
`npm run start:dev` en cada uno (más lento de arrancar, pero con hot-reload):
```
cd infra\docker-compose
docker compose up -d postgres-users postgres-bookings postgres-catalog postgres-payments zookeeper kafka redis
```

### URLs útiles una vez levantado
| Qué | URL |
|---|---|
| **Swagger unificado** (los 6 servicios, un solo selector) | http://localhost:8089 |
| Kong — proxy API gateway | http://localhost:8000/api/... |
| Kong — dashboard de rutas/plugins | http://localhost:8088 |
| Grafana | http://localhost:3000 |
| Prometheus | http://localhost:9090 |
| Kibana — logs centralizados (índice `airserviz-logs-*`) | http://localhost:5601 |
| client-app / provider-app | http://localhost:5173 / :5174 (`npm run dev` en cada `apps/*`) |
| admin-dashboard (requiere rol ADMIN) | http://localhost:5175 |

Ver docs/adr/ para decisiones de arquitectura registradas.
Ver docs/migrations.md para el flujo de migraciones TypeORM.
