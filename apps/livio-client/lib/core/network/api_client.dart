import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../storage/token_storage.dart';

/// Cliente HTTP contra Kong, con renovación transparente de token.
///
/// El problema que resuelve
/// ------------------------
/// El access token dura 15 minutos. Cualquier sesión real lo agota, así que sin
/// renovación automática el usuario vería errores aleatorios a media sesión.
/// El interceptor detecta el 401, canjea el refresh token, y **reintenta la
/// petición original**: para las capas de arriba, nunca ocurrió.
class ApiClient {
  final TokenStorage _tokens;

  /// Se invoca cuando la sesión es irrecuperable (el refresh también falló).
  /// La app debe volver al login.
  final void Function()? onSessionExpired;

  late final Dio dio;

  /// Refresco en curso, si lo hay. Ver [_refreshOnce].
  Future<bool>? _refreshInFlight;

  /// Marca en `extra` para no reintentar en bucle la misma petición.
  static const _retriedFlag = 'livio_retried';

  ApiClient(this._tokens, {this.onSessionExpired}) {
    dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
        contentType: Headers.jsonContentType,
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(onRequest: _onRequest, onError: _onError),
    );
  }

  // ── Interceptores ──────────────────────────────────────────────────────────

  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Las rutas de auth no llevan Authorization: /login y /refresh no lo
    // necesitan, y mandar un token caducado solo enturbia el diagnóstico.
    if (!_isAuthRoute(options.path)) {
      final token = await _tokens.readAccess();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  Future<void> _onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final isUnauthorized = err.response?.statusCode == 401;
    final alreadyRetried = err.requestOptions.extra[_retriedFlag] == true;

    // Un 401 en /auth/login significa "credenciales incorrectas", no "token
    // caducado": renovarlo no tiene sentido y taparía el error real.
    if (!isUnauthorized || alreadyRetried || _isAuthRoute(err.requestOptions.path)) {
      return handler.next(err);
    }

    final refreshed = await _refreshOnce();
    if (!refreshed) {
      await _tokens.clear();
      onSessionExpired?.call();
      return handler.next(err);
    }

    try {
      final options = err.requestOptions
        ..extra[_retriedFlag] = true
        ..headers['Authorization'] = 'Bearer ${await _tokens.readAccess()}';
      return handler.resolve(await dio.fetch(options));
    } on DioException catch (retryError) {
      return handler.next(retryError);
    }
  }

  // ── Renovación ─────────────────────────────────────────────────────────────

  /// Garantiza que solo haya **un** refresco en vuelo a la vez.
  ///
  /// No es una optimización, es corrección. `auth-service` revoca el refresh
  /// token anterior al emitir uno nuevo (el fix de pre-hash SHA-256 sobre
  /// bcrypt hizo que esa revocación funcione de verdad). Si dos peticiones
  /// caducan a la vez y cada una lanza su propio refresco, el segundo invalida
  /// al primero y la sesión se cae aunque el token fuera válido. Al compartir
  /// el mismo Future, todas esperan al mismo canje.
  Future<bool> _refreshOnce() {
    return _refreshInFlight ??=
        _performRefresh().whenComplete(() => _refreshInFlight = null);
  }

  Future<bool> _performRefresh() async {
    final refreshToken = await _tokens.readRefresh();
    if (refreshToken == null) return false;

    try {
      // Dio nuevo y sin interceptores a propósito: si este 401 volviera a pasar
      // por el interceptor, entraría en recursión infinita.
      final bare = Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl));
      final response = await bare.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      final data = response.data?['data'] as Map<String, dynamic>?;
      final access = data?['accessToken'] as String?;
      final refresh = data?['refreshToken'] as String?;
      if (access == null || refresh == null) return false;

      await _tokens.save(access: access, refresh: refresh);
      return true;
    } on DioException {
      return false;
    }
  }

  bool _isAuthRoute(String path) =>
      path.contains('/auth/login') ||
      path.contains('/auth/refresh') ||
      path.contains('/auth/register');
}
