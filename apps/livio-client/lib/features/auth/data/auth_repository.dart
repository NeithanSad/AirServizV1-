import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';
import '../domain/session.dart';

/// Errores de autenticación ya traducidos a algo que se puede enseñar al
/// usuario. La UI no debería tener que saber qué es un DioException.
class AuthFailure implements Exception {
  final String message;
  const AuthFailure(this.message);
  @override
  String toString() => message;
}

class AuthRepository {
  final ApiClient _api;
  final TokenStorage _tokens;

  AuthRepository(this._api, this._tokens);

  /// Login contra `POST /api/auth/login` (ruta pública en Kong: es la que
  /// emite los tokens, así que no puede exigir uno).
  Future<UserProfile> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _api.dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'email': email, 'password': password},
      );

      // Todas las respuestas del backend vienen envueltas: {success, data:{...}}
      final data = response.data?['data'] as Map<String, dynamic>?;
      if (data == null) {
        throw const AuthFailure('El servidor devolvió una respuesta inesperada.');
      }

      final tokens = AuthTokens.fromJson(data);
      await _tokens.save(
        access: tokens.accessToken,
        refresh: tokens.refreshToken,
      );

      return await me();
    } on DioException catch (e) {
      throw AuthFailure(_describe(e));
    }
  }

  /// Perfil del usuario autenticado. `auth-service` valida el token él mismo
  /// en esta ruta (Kong la deja pasar por ser parte del servicio de auth).
  Future<UserProfile> me() async {
    try {
      final response = await _api.dio.get<Map<String, dynamic>>('/auth/me');
      final data = response.data?['data'] as Map<String, dynamic>?;
      if (data == null) {
        throw const AuthFailure('No se pudo leer el perfil.');
      }
      return UserProfile.fromJson(data);
    } on DioException catch (e) {
      throw AuthFailure(_describe(e));
    }
  }

  Future<void> logout() => _tokens.clear();

  Future<bool> get hasStoredSession => _tokens.hasSession;

  /// Traduce el fallo de red a un mensaje concreto. Distinguir "no llego al
  /// servidor" de "credenciales mal" ahorra muchísimo tiempo de diagnóstico,
  /// sobre todo en móvil, donde la causa más común es apuntar a la URL
  /// equivocada y no un error real de la app.
  String _describe(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.connectionError:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'No se pudo contactar con el servidor.\n\n'
            'Comprueba que el backend está levantado y que la app apunta a la '
            'dirección correcta (ahora mismo: ${e.requestOptions.baseUrl}).';
      case DioExceptionType.badResponse:
        final code = e.response?.statusCode;
        if (code == 401) return 'Correo o contraseña incorrectos.';
        if (code == 429) return 'Demasiados intentos. Espera un momento.';
        final serverMessage = _extractMessage(e.response?.data);
        return serverMessage ?? 'El servidor respondió con un error ($code).';
      default:
        return 'Error inesperado: ${e.message ?? e.type.name}';
    }
  }

  String? _extractMessage(Object? body) {
    if (body is Map && body['message'] != null) {
      final m = body['message'];
      return m is List ? m.join('\n') : m.toString();
    }
    return null;
  }
}
