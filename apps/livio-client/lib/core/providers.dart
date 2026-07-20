import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/data/auth_repository.dart';
import '../features/catalog/data/catalog_repository.dart';
import 'network/api_client.dart';
import 'storage/token_storage.dart';

/// Grafo de dependencias de la app.
///
/// Se declara en un solo sitio para que sustituir una pieza en los tests sea
/// un `overrideWith` y no una refactorización: es el equivalente Riverpod de
/// los providers de un módulo de NestJS.

final tokenStorageProvider =
    Provider<TokenStorage>((ref) => SecureTokenStorage());

/// Señal de "la sesión murió y no se pudo recuperar". La emite el interceptor
/// cuando el refresh token también falla; la escucha la UI para volver al login.
///
/// Es un Notifier y no un StateProvider porque Riverpod 3 retiró este último.
class SessionExpiredNotifier extends Notifier<bool> {
  @override
  bool build() => false;

  void signal() => state = true;

  /// La UI lo baja tras reaccionar, para que un segundo vencimiento vuelva a
  /// disparar el listener.
  void reset() => state = false;
}

final sessionExpiredProvider =
    NotifierProvider<SessionExpiredNotifier, bool>(SessionExpiredNotifier.new);

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    ref.watch(tokenStorageProvider),
    onSessionExpired: () =>
        ref.read(sessionExpiredProvider.notifier).signal(),
  );
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.watch(apiClientProvider),
    ref.watch(tokenStorageProvider),
  );
});

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  return CatalogRepository(ref.watch(apiClientProvider));
});
