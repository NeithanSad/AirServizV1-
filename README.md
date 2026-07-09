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
```
cd infra\docker-compose
docker compose up -d
```

Ver docs/adr/ para decisiones de arquitectura registradas.
