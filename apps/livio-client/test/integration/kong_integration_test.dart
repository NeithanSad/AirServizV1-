@Tags(['integration'])
library;

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:livio_client/core/network/api_client.dart';
import 'package:livio_client/core/storage/token_storage.dart';
import 'package:livio_client/features/auth/data/auth_repository.dart';
import 'package:livio_client/features/catalog/data/catalog_repository.dart';

/// Verificación de los cuatro criterios de la Fase 1 contra el backend REAL.
///
/// No usa emulador: sustituye el almacén seguro (que necesita canales de
/// plataforma) por uno en memoria, y habla con Kong por HTTP como lo haría la
/// app. Eso deja fuera el renderizado, pero cubre lo que la Fase 1 existe para
/// validar: que la integración con el gateway funciona de verdad.
///
/// Requiere el stack levantado:
///   cd infra/docker-compose && docker compose --profile services up -d
///
/// Ejecutar con:
///   flutter test test/integration --dart-define=API_BASE_URL=http://localhost:8000/api
///
/// Se excluye de `flutter test` normal mediante la etiqueta `integration`
/// declarada en dart_test.yaml, para que CI no falle sin backend.
void main() {
  // Usuario sembrado en el entorno de desarrollo local. Vive aquí y no en la
  // app: un fichero de test nunca se empaqueta en el APK. Sobreescribible por
  // si tu backend tiene otros datos de prueba:
  //   --dart-define=TEST_EMAIL=... --dart-define=TEST_PASSWORD=...
  const email = String.fromEnvironment(
    'TEST_EMAIL',
    defaultValue: 'smoke-test@airserviz.dev',
  );
  const password = String.fromEnvironment(
    'TEST_PASSWORD',
    defaultValue: 'Test1234!',
  );

  late InMemoryTokenStorage tokens;
  late ApiClient api;
  late AuthRepository auth;
  late CatalogRepository catalog;
  var sessionExpiredFired = false;

  setUp(() {
    tokens = InMemoryTokenStorage();
    sessionExpiredFired = false;
    api = ApiClient(tokens, onSessionExpired: () => sessionExpiredFired = true);
    auth = AuthRepository(api, tokens);
    catalog = CatalogRepository(api);
  });

  test('CRITERIO 2 — el catálogo es público: responde sin ningún token',
      () async {
    final services = await catalog.fetchServices();
    expect(services, isNotEmpty, reason: 'el catálogo de desarrollo tiene datos');

    // Y de paso comprueba que el precio se parseó: llega como String desde
    // Postgres, y un fallo silencioso aquí dejaría todo a 0.
    expect(services.first.price, greaterThan(0));
  });

  test('CRITERIO 1 — login vía Kong devuelve tokens y perfil', () async {
    final user = await auth.login(email: email, password: password);

    expect(user.email, email);
    expect(await tokens.readAccess(), isNotNull);
    expect(await tokens.readRefresh(), isNotNull);
  });

  test('login con credenciales incorrectas da un mensaje claro, no un crudo 401',
      () async {
    await expectLater(
      auth.login(email: email, password: 'contrasena-incorrecta'),
      throwsA(
        isA<AuthFailure>().having(
          (e) => e.message,
          'message',
          contains('incorrect'),
        ),
      ),
    );
  });

  test('CRITERIO 3 — Kong acepta el token en una ruta protegida', () async {
    await auth.login(email: email, password: password);

    final status = await catalog.probeProtectedRoute();

    // 401 significaría que Kong rechazó el token, es decir, que JWT_SECRET no
    // coincide entre auth-service y el consumer del gateway.
    expect(status, isNot(401), reason: 'Kong rechazó un token recién emitido');
    expect(status, inInclusiveRange(200, 299));
  });

  test('sin token, la ruta protegida da 401 (la puerta de Kong existe)',
      () async {
    final status = await catalog.probeProtectedRoute();
    expect(status, 401);
  });

  test(
    'CRITERIO 4 — un access token inválido se renueva solo y la petición se reintenta',
    () async {
      await auth.login(email: email, password: password);
      final originalAccess = await tokens.readAccess();

      // Esperar a que cambie el segundo NO es un apaño: el payload del JWT
      // lleva `iat`/`exp` en segundos, así que dos tokens emitidos para el
      // mismo usuario dentro del mismo segundo salen byte a byte idénticos.
      // Sin esta pausa, comprobar "el token cambió" daría un falso negativo
      // aunque la renovación hubiera funcionado.
      await Future<void>.delayed(const Duration(milliseconds: 1100));

      // Se invalida el access token conservando el refresh: es lo mismo que
      // ocurre a los 15 minutos, pero sin esperar 15 minutos.
      tokens.corruptAccessToken();

      // Esta llamada debe fallar con 401, renovarse por debajo y reintentarse.
      // Si el interceptor no funcionara, lanzaría.
      final user = await auth.me();

      expect(user.email, email);
      expect(sessionExpiredFired, isFalse,
          reason: 'la sesión era recuperable, no debió expulsar al usuario');

      final newAccess = await tokens.readAccess();
      expect(newAccess, isNotNull);
      expect(newAccess, isNot('token.invalido.a-proposito'),
          reason: 'el token no se renovó');
      expect(newAccess, isNot(originalAccess),
          reason: 'auth-service debería emitir un access token distinto');
    },
  );

  test(
    'si el refresh token tampoco vale, se avisa de sesión expirada y se limpia',
    () async {
      await tokens.save(access: 'a.b.c', refresh: 'refresh-invalido');

      await expectLater(auth.me(), throwsA(isA<AuthFailure>()));

      expect(sessionExpiredFired, isTrue);
      expect(await tokens.readAccess(), isNull);
      expect(await tokens.readRefresh(), isNull);
    },
  );

  test('renovaciones concurrentes producen UN solo canje', () async {
    await auth.login(email: email, password: password);
    tokens.corruptAccessToken();

    // Tres peticiones que caducan a la vez. auth-service revoca el refresh
    // token anterior al emitir uno nuevo, así que si cada una lanzara su propio
    // canje, la segunda invalidaría a la primera y alguna fallaría.
    final results = await Future.wait([
      auth.me(),
      auth.me(),
      auth.me(),
    ]);

    expect(results.every((u) => u.email == email), isTrue,
        reason: 'el bloqueo de refresco único no está funcionando');
    expect(sessionExpiredFired, isFalse);
  });
}

/// Comprobación previa: si el backend no está levantado, los tests de arriba
/// fallan con errores de red confusos. Esto lo dice claro.
Future<bool> backendIsReachable(String baseUrl) async {
  try {
    await Dio().get('$baseUrl/services');
    return true;
  } on DioException {
    return false;
  }
}
