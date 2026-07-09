# payment-service

Microservicio de pagos. Consume `order_confirmed`, crea un cobro a través de un
**gateway de pago (Stripe simulado)** y, al confirmarse el pago, emite
`payment_processed`.

- **Stack:** NestJS + TypeORM + PostgreSQL (`postgres-payments`, puerto host 5436) + kafkajs
- **Puerto:** 3006 — Swagger en `http://localhost:3006/api/docs`

## Flujo

```
booking-service ──(order_confirmed)──► payment-service
                                          │  crea PaymentIntent (gateway)
                                          │  status = REQUIRES_PAYMENT
        cliente "paga" (POST /:id/pay) ───┤
                                          │  webhook firmado (HMAC t=…,v1=…)
                                          │  verifica firma → PAID / FAILED
                                          ▼
                    payment_processed ──► notification-service
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET  | `/payments?clientId=` | Listar pagos |
| GET  | `/payments/order/:orderId` | Pago de una orden |
| POST | `/payments/webhook` | Webhook del proveedor (verifica firma `stripe-signature`) |
| POST | `/payments/:id/pay` | **[demo]** Simular que el cliente paga (`{ "outcome": "success" \| "fail" }`) |

## Gateway simulado

`StripeSimulatedGateway` no llama a ninguna API externa, pero reproduce lo que
importa de Stripe: ids de PaymentIntent, envelope de evento y **firmas HMAC de
webhook** (esquema `t=…,v1=…`), por lo que la verificación de firma se ejecuta
de verdad. Para ir a producción, implementa la interfaz `PaymentGateway` con el
SDK real de Stripe y cambia el binding en `payments.module.ts`.

## Idempotencia

- `order_confirmed` duplicado → no crea un segundo pago (orderId único).
- Webhook duplicado → si el pago ya está `PAID`/`FAILED`, se ignora.

## Desarrollo local

```
npm install
npm run start:dev
```

Requiere `postgres-payments` y Kafka levantados (`infra/docker-compose`).
