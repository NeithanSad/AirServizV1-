import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/auth_repository.dart';
import '../domain/session.dart';

/// Estado de la sesión.
sealed class AuthState {
  const AuthState();
}

/// Aún no sabemos si hay sesión guardada (se está comprobando al arrancar).
class AuthUnknown extends AuthState {
  const AuthUnknown();
}

class AuthSignedOut extends AuthState {
  /// Mensaje a mostrar tras un login fallido o una sesión caducada.
  final String? message;
  const AuthSignedOut({this.message});
}

class AuthSigningIn extends AuthState {
  const AuthSigningIn();
}

class AuthSignedIn extends AuthState {
  final UserProfile user;
  const AuthSignedIn(this.user);
}

class AuthController extends Notifier<AuthState> {
  AuthRepository get _repo => ref.read(authRepositoryProvider);

  @override
  AuthState build() {
    _restore();
    return const AuthUnknown();
  }

  /// Al arrancar, si hay tokens guardados intentamos revalidarlos.
  ///
  /// No basta con "hay un token, luego estoy dentro": puede llevar días
  /// guardado y estar caducado o revocado. Preguntamos a `/auth/me`, y si el
  /// access token venció, el interceptor lo renueva por debajo de forma
  /// transparente. Si tampoco eso funciona, entonces sí, fuera.
  Future<void> _restore() async {
    if (!await _repo.hasStoredSession) {
      state = const AuthSignedOut();
      return;
    }
    try {
      state = AuthSignedIn(await _repo.me());
    } on AuthFailure {
      await _repo.logout();
      state = const AuthSignedOut();
    }
  }

  Future<void> signIn(String email, String password) async {
    state = const AuthSigningIn();
    try {
      state = AuthSignedIn(await _repo.login(email: email, password: password));
    } on AuthFailure catch (e) {
      state = AuthSignedOut(message: e.message);
    }
  }

  Future<void> signOut({String? message}) async {
    await _repo.logout();
    state = AuthSignedOut(message: message);
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
