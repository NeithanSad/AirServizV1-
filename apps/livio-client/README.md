# Livio — app cliente (piloto Flutter)

Piloto de la **Fase 1**: valida la integración con el backend real (Kong + JWT)
antes de reescribir las apps completas. Dos pantallas, login y catálogo. Nada de
reservas, pagos ni notificaciones — eso es Fase 2.

## Qué valida

| # | Criterio | Cómo se comprueba |
|---|---|---|
| 1 | Login vía Kong devuelve tokens y perfil | Test de integración + pantalla de login |
| 2 | El catálogo responde **sin** token (ruta pública) | Test + listado en la app |
| 3 | Kong **acepta** el token en una ruta protegida | Test + botón «Probar ruta protegida» |
| 4 | Un token caducado se **renueva solo** y la petición se reintenta | Test (invalida el token a propósito) |

El criterio 4 es el que justifica el piloto: el access token dura **15 minutos**,
así que cualquier sesión real lo agota. Si el refresco no se diseña desde el
principio, en la Fase 2 hay que meterlo a martillazos entre pantallas ya hechas.

## Ejecutar

Con el backend levantado (`docker compose --profile services up -d`):

```bash
flutter run                                    # emulador Android → 10.0.2.2:8000
```

Otras formas de apuntar al backend:

```bash
# Móvil físico por USB — no necesita hosting ni TLS
adb reverse tcp:8000 tcp:8000
flutter run --dart-define=API_BASE_URL=http://localhost:8000/api

# Móvil por WiFi — añade también tu IP en
# android/app/src/debug/res/xml/network_security_config.xml
flutter run --dart-define=API_BASE_URL=http://192.168.1.40:8000/api
```

### Precargar el formulario de login

El formulario sale **vacío** por defecto, y es intencionado: un usuario de
prueba escrito en el código acabaría dentro del APK publicado, apareciéndole a
gente real con credenciales ajenas ya rellenas. Si quieres la comodidad en
desarrollo, pídela explícitamente:

```bash
flutter run \
  --dart-define=DEV_EMAIL=smoke-test@airserviz.dev \
  --dart-define=DEV_PASSWORD='Test1234!'
```

La app avisa en pantalla cuando el formulario viene precargado, para que no se
confunda con una sesión ya iniciada.

## Tests

```bash
flutter test                    # unitarios — no necesitan backend
flutter test test/integration --dart-define=API_BASE_URL=http://localhost:8000/api --run-skipped
```

Los de integración hablan con el backend de verdad, así que están etiquetados y
se saltan por defecto: en CI no hay stack levantado y fallarían por red, no por
código. Sustituyen el almacén seguro por uno en memoria, de modo que corren sin
emulador ni dispositivo.

## Decisiones

- **Riverpod** para estado, **dio** para HTTP, **flutter_secure_storage** para
  los tokens. El almacén es una interfaz (`TokenStorage`) con dos
  implementaciones: la segura y una en memoria para pruebas.
- **La URL base nunca va a fuego** — siempre por `--dart-define`. La misma app
  corre contra emulador, USB, LAN y producción, y son cuatro valores distintos.
- **Todo pasa por Kong**, nunca directo a un microservicio: el gateway es quien
  valida el JWT y aplica el rate-limit, así que saltárselo daría una falsa
  sensación de que funciona.
- **Renovación con bloqueo de un solo canje.** No es una optimización:
  `auth-service` revoca el refresh token anterior al emitir uno nuevo, así que
  dos refrescos concurrentes se invalidarían mutuamente.
- **Tráfico sin cifrar solo en debug.** La excepción vive en
  `android/app/src/debug/`, que Gradle no incluye en release, y lista
  direcciones concretas en lugar de abrir el HTTP a cualquier host.

## Notas de comportamiento del backend

- `price` llega como **String**: TypeORM serializa las columnas `numeric` de
  Postgres así para no perder precisión. `ServiceItem` acepta ambas formas.
- Todas las respuestas vienen envueltas en `{success, data: {...}}`.
- Dos JWT emitidos para el mismo usuario **dentro del mismo segundo son
  idénticos**, porque `iat`/`exp` tienen resolución de segundos. Importa al
  escribir tests: comprobar «el token cambió» sin esperar a que avance el
  segundo da un falso negativo.

## Pendiente

- **Interfaz no verificada en dispositivo**: no hay ningún emulador Android
  creado en esta máquina. La lógica está cubierta por los tests de integración,
  pero el renderizado no se ha visto todavía.
- **iOS sin probar**: compilar para iOS exige macOS. Plan acordado: Android
  primero, iOS más adelante con Mac o CI en la nube.
