# AirServiz

**Marketplace de servicios locales bajo demanda** — arquitectura de microservicios orientada a eventos.

Un cliente busca un servicio en el catálogo, lo agenda con fecha y paga; el proveedor confirma, reprograma o cancela; ambos reciben notificaciones en tiempo real.

**Stack:** NestJS · React + Vite · PostgreSQL · Kong · Kafka · Redis · Docker · Kubernetes · AWS Lambda · Prometheus/Grafana · ELK

---

## Arranque rápido

Requisito único: **Docker Desktop**.

```bash
# 1. Generar los secretos locales (una sola vez)
cp infra/docker-compose/.env.example infra/docker-compose/.env
bash scripts/rotate-secrets.sh

# 2. Levantar el stack
cd infra/docker-compose
docker compose --profile services up -d
```

El primer paso no es opcional: el `docker-compose.yaml` no contiene ningún
secreto y **se niega a arrancar** si falta alguno, en vez de caer a un valor por
defecto inseguro. `rotate-secrets.sh` los genera y los propaga a todos los
sitios que deben compartirlos.

Eso levanta **todo** (23 contenedores): los 3 frontends, Kong, los 6 microservicios, las 4 bases, Redis, Kafka y el stack de observabilidad. La primera vez tarda unos minutos construyendo imágenes.

<details>
<summary><b>Alternativa: solo infraestructura</b> (para desarrollar con hot-reload)</summary>

Sin `--profile services` solo arranca la infraestructura; luego corres a mano los servicios que estés tocando:

```bash
cd infra/docker-compose
docker compose up -d          # infra: postgres x4, kafka, redis, kong, ELK...

cd services/booking-service   # y en otra terminal, el servicio que edites
npm install && npm run start:dev
```
</details>

### URLs

| Qué | URL |
|---|---|
| client-app (cliente) | http://localhost:5173 |
| provider-app (proveedor) | http://localhost:5174 |
| admin-dashboard (requiere rol `ADMIN`) | http://localhost:5175 |
| **Kong** — gateway, entrada de toda la API | http://localhost:8000/api/… |
| **Swagger unificado** — los 6 servicios en un selector | http://localhost:8089 |
| Kong — dashboard de rutas y plugins | http://localhost:8088 |
| **Kibana** — logs centralizados (`airserviz-logs-*`) | http://localhost:5601 |
| Grafana — dashboards de métricas | http://localhost:3000 (`admin`/`admin`) |
| Prometheus | http://localhost:9090 |
| Kafka UI — topics y mensajes | http://localhost:8080 |

> **Nota:** los puertos `3001`-`3006` y `5433`-`5436` quedan publicados en el host. Si algún contenedor no arranca por *"port is already allocated"*, casi siempre es un `npm run start:dev` o un Postgres local ocupando el puerto.

---

## Arquitectura

```
   client-app   provider-app   admin-dashboard        (React + Vite, nginx)
        └─────────────┼──────────────┘
                      ▼
              Kong :8000  ── valida JWT · rate-limit · enruta
                      │
     ┌──────┬─────────┼─────────┬──────────┬──────────┐
     ▼      ▼         ▼         ▼          ▼          ▼
   auth   user     catalog   booking    payment   notification
   :3001  :3005     :3004     :3002      :3006       :3003
     │      │         │  │       │          │           ▲
     ▼      ▼         ▼  ▼       ▼          ▼           │
   ┌────────────┐  ┌────┐┌─────┐┌────────┐┌─────────┐  │
   │ users_db   │  │cat ││Redis││bookings││payments │  │
   │  :5433     │  │:5435    ..│ │ :5434 ││  :5436  │  │
   └────────────┘  └────┘└─────┘└────────┘└─────────┘  │
                                    │          │        │
                                    ▼          ▼        │
                            ═══════ Apache Kafka ═══════┘
                              (bus de eventos · Zookeeper)
```

### Microservicios

| Servicio | Puerto | Responsabilidad | Base de datos |
|---|---|---|---|
| `auth-service` | 3001 | Registro, login, emisión y refresh de JWT | postgres-users (5433) |
| `booking-service` | 3002 | Órdenes: máquina de estados + emisión de eventos | postgres-bookings (5434) |
| `notification-service` | 3003 | Consume todos los eventos, feed SSE en vivo | en memoria (sin BD) |
| `catalog-service` | 3004 | Catálogo de servicios, caché Redis, subida de imágenes | postgres-catalog (5435) |
| `user-service` | 3005 | Perfiles (foto, bio, ciudad, geo) | postgres-users (5433)¹ |
| `payment-service` | 3006 | Cobros (pasarela simulada) + webhook firmado | postgres-payments (5436) |

> ¹ `auth` y `user` comparten la instancia de Postgres pero en **tablas distintas** (`users` vs `profiles`): mismo *bounded context*, cero acoplamiento de esquema.

**Database-per-service:** ningún servicio consulta la BD de otro. La única vía de datos entre servicios es la API o Kafka.

### Eventos (Kafka)

| Topic | Produce | Consume |
|---|---|---|
| `order_created` | booking | — |
| `order_confirmed` | booking | **payment**, notification |
| `order_cancelled` | booking | notification |
| `order_rescheduled` | booking | notification |
| `payment_processed` | payment | notification |

Entrega *at-least-once* → los consumidores son **idempotentes** (procesar un evento dos veces no genera un cobro doble).

**Flujo estelar:** confirmar orden → `order_confirmed` → payment cobra → `payment_processed` → notification avisa por SSE.

---

## Estructura del repo

```
apps/          3 frontends React (client, provider, admin) — Dockerfile + nginx cada uno
services/      6 microservicios NestJS
libs/          contratos de eventos y DTOs compartidos
serverless/    Lambda image-optimizer (sharp → WebP → S3)
infra/
  docker-compose/   el entorno completo (23 contenedores)
  kong/             config declarativa del gateway (+ dashboard)
  k8s/              manifiestos Kubernetes (despliegue alternativo)
  observability/    Prometheus, Grafana, pipeline de Logstash
  swagger-ui/       agregador de los 6 OpenAPI
docs/
  diagrams/         C4 (contexto, contenedores, componentes) + infraestructura
  adr/              decisiones de arquitectura
  api-contracts/    OpenAPI
  migrations.md     flujo de migraciones TypeORM
```

---

## Tests

68 pruebas automatizadas sobre los 6 servicios. Corren en CI con cada push.

```bash
cd services/booking-service && npm test    # 17 tests: máquina de estados
```

| Servicio | Tests | Qué cubre |
|---|---|---|
| booking | 17 | Transiciones válidas/inválidas, permisos por rol, reprogramación |
| auth | 12 | Hashing bcrypt real, JWT real, login, refresh y revocación |
| catalog | 12 | Cache-aside, invalidación, ownership |
| notification | 12 | Mapeo de eventos, broadcast SSE, tope de historial |
| user | 11 | Upsert de perfiles, guardia de ownership |
| payment | 4 | **Idempotencia del webhook** (no cobrar dos veces) |

---

## Infraestructura

- **Kong** (DB-less, YAML declarativo): único punto de entrada. Valida JWT HS256, aplica rate-limit (60/min, 1000/h) y añade `correlation-id`. Rutas de lectura del catálogo públicas; órdenes, pagos y escrituras exigen token.
- **AWS Lambda** (`serverless/image-optimizer`, desplegada en `us-east-1`): al subir la foto de un servicio, `catalog-service` la invoca por SDK; optimiza con `sharp` (→ WebP ≤1024px) y la guarda en S3. Escala a cero.
- **Redis**: caché *cache-aside* del catálogo (TTL 60s) con invalidación O(1) por *version-key*. Si Redis cae, las lecturas degradan a Postgres sin romperse.
- **Observabilidad**: Prometheus scrapea `/metrics` de los 6 servicios → Grafana. Los logs (pino, JSON) van a Logstash → Elasticsearch → Kibana.
- **CI/CD**: GitHub Actions con filtros por path (solo se reconstruye lo que cambió) → publica imágenes a `ghcr.io`.
- **Kubernetes**: `infra/k8s` — Deployment + Service + HPA por servicio, Postgres con PVC.

### Migraciones

Los servicios con BD corren migraciones TypeORM al arrancar (`migrationsRun: true`). Ver [docs/migrations.md](docs/migrations.md).

---

## Configuración

### Secretos

**Fuente única de verdad: [`infra/docker-compose/.env`](infra/docker-compose/.env.example)** (no versionado). Ahí viven `JWT_SECRET`, `STRIPE_WEBHOOK_SECRET`, las contraseñas de las 4 bases y las credenciales AWS. Ningún secreto está commiteado.

```bash
bash scripts/rotate-secrets.sh   # genera valores nuevos y los propaga
```

Tres decisiones de diseño detrás de esto:

1. **Fail-closed en todas partes.** El compose usa `${VAR:?mensaje}`, así que una variable ausente **aborta el arranque** en lugar de usar un default. Igual el gateway de pagos, que se niega a construirse sin `STRIPE_WEBHOOK_SECRET`, y el renderizador de Kong, que aborta si el secreto es corto o no llegó a sustituirse.

2. **Kong no puede desincronizarse de auth-service.** La config declarativa de Kong es una plantilla versionada ([`kong.yaml.template`](infra/kong/kong.yaml.template)) con el marcador `__JWT_SECRET__`; el contenedor `kong-config-init` la renderiza al arrancar leyendo el **mismo** `JWT_SECRET` que recibe auth-service. Antes el valor estaba copiado a mano en 6 archivos y cualquier rotación parcial provocaba `401` en toda la API.

   > Kong 3.6 no sirve para esto de fábrica: las referencias `{vault://env/...}` aún no soportan credenciales `jwt_secrets` en modo DB-less ([Kong/kong#14775](https://github.com/Kong/kong/pull/14775)) y, peor, una referencia sin resolver degrada el secreto a cadena vacía en vez de fallar.

3. **Una contraseña por base de datos**, coherente con *database-per-service*: comprometer una no da acceso a las otras tres.

Los `.env.example` de cada servicio siguen existiendo para el flujo host (`npm run start:dev`) y solo contienen marcadores. En un clúster real, crea el Secret fuera de git (`kubectl create secret`, sealed-secrets o external-secrets); ver [`infra/k8s/01-config.yaml`](infra/k8s/01-config.yaml).

Para que `catalog-service` pueda invocar la Lambda necesita credenciales AWS: ver [`infra/docker-compose/.env.example`](infra/docker-compose/.env.example) y el [README de la Lambda](serverless/image-optimizer/README.md).

**Rotar las contraseñas de PostgreSQL** es un caso aparte, porque `POSTGRES_PASSWORD` solo se aplica al inicializar un volumen vacío: editarlo en el `.env` con datos ya creados no rota nada, solo rompe la conexión. En vez de `down -v` (que borraría los datos), usa:

```bash
bash scripts/rotate-db-passwords.sh    # ALTER USER in-situ, sin pérdida de datos
cd infra/docker-compose && docker compose --profile services up -d --force-recreate
```

> ⚠️ **Las contraseñas de Postgres solo se exigen desde fuera del contenedor.** El `pg_hba.conf` por defecto de la imagen oficial usa `trust` para el socket local y para `127.0.0.1`, y solo aplica `scram-sha-256` a las conexiones que llegan de otro host. Dos consecuencias: comprobar una contraseña con `docker exec ... psql` **no comprueba nada** (pasa siempre), y quien tenga ejecución dentro del contenedor entra sin contraseña. Aceptable mientras las bases vivan solo en la red interna del stack; a endurecer si alguna vez se exponen.

---

## Documentación

| Documento | Qué contiene |
|---|---|
| [Documentación técnica](docs/AirServiz-Documentacion-Tecnica.docx) | Visión general, arquitectura, gateway, infraestructura, despliegue |
| [Diagramas C4](docs/diagrams/) | Contexto (L1), contenedores (L2), componentes (L3) e infraestructura |
| [docs/adr/](docs/adr/) | Decisiones de arquitectura registradas |
| [docs/migrations.md](docs/migrations.md) | Flujo de migraciones TypeORM |
| Swagger unificado | http://localhost:8089 (con el entorno levantado) |

---

## Estado y limitaciones conocidas

Somos explícitos con lo que está y lo que no:

- ✅ **Implementado y verificado:** los 6 microservicios, Kong con JWT, Kafka, Redis, la Lambda desplegada en AWS real, ELK, Prometheus/Grafana, 71 tests en CI.
- ⚠️ **La pasarela de pago es simulada** — `StripeSimulatedGateway`, detrás de la interfaz `PaymentGateway`, con verificación de firma HMAC real. Migrar a Stripe real = implementar la interfaz y cambiar un *binding* de DI; la lógica de negocio no cambia.
- ⚠️ **`notification-service` no persiste**: el historial vive en memoria y se pierde al reiniciar.
- ✅ **Secretos fuera de git**: ningún secreto está versionado. `.env` es la fuente única de verdad, el compose falla si falta alguno, y `scripts/rotate-secrets.sh` rota y propaga. El Secret de K8s es un placeholder inválido a propósito, para que un despliegue sin configurar falle en vez de arrancar débil.
- ✅ **Contraseñas de PostgreSQL rotadas**: una distinta por base, de 32 bytes, rotadas in-situ sin pérdida de datos y verificadas desde la red (ver *Configuración*).
- ⚠️ **`booking-service` tiene `REDIS_HOST` configurado pero no lo usa** — variable pendiente de un caso de uso real.
