import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Custodia de los tokens de sesión.
///
/// Es una interfaz y no una clase concreta para que las pruebas puedan usar una
/// implementación en memoria: el almacén seguro real depende de canales de
/// plataforma y solo funciona sobre un dispositivo o emulador, lo que impediría
/// probar el interceptor de renovación en un test de Dart normal.
abstract class TokenStorage {
  Future<String?> readAccess();
  Future<String?> readRefresh();
  Future<void> save({required String access, required String refresh});
  Future<void> clear();

  Future<bool> get hasSession async => (await readRefresh()) != null;
}

/// Implementación real: Keystore en Android, Keychain en iOS.
///
/// Deliberadamente NO `shared_preferences`: en un dispositivo rooteado o con
/// copia de seguridad activada, unas preferencias planas dejan el refresh token
/// a la vista. Es la diferencia entre poder robar una sesión y no poder.
class SecureTokenStorage implements TokenStorage {
  static const _kAccess = 'livio_access_token';
  static const _kRefresh = 'livio_refresh_token';

  final FlutterSecureStorage _storage;

  SecureTokenStorage([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  @override
  Future<String?> readAccess() => _storage.read(key: _kAccess);

  @override
  Future<String?> readRefresh() => _storage.read(key: _kRefresh);

  @override
  Future<void> save({required String access, required String refresh}) async {
    await _storage.write(key: _kAccess, value: access);
    await _storage.write(key: _kRefresh, value: refresh);
  }

  @override
  Future<void> clear() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
  }

  @override
  Future<bool> get hasSession async => (await readRefresh()) != null;
}

/// Implementación volátil, para pruebas. No persiste nada.
class InMemoryTokenStorage implements TokenStorage {
  String? _access;
  String? _refresh;

  @override
  Future<String?> readAccess() async => _access;

  @override
  Future<String?> readRefresh() async => _refresh;

  @override
  Future<void> save({required String access, required String refresh}) async {
    _access = access;
    _refresh = refresh;
  }

  @override
  Future<void> clear() async {
    _access = null;
    _refresh = null;
  }

  @override
  Future<bool> get hasSession async => _refresh != null;

  /// Fuerza un access token inválido conservando el refresh token: así se puede
  /// provocar el 401 que dispara la renovación sin esperar 15 minutos.
  void corruptAccessToken() => _access = 'token.invalido.a-proposito';
}
