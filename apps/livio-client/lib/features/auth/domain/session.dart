/// Par de tokens que emite `auth-service`.
class AuthTokens {
  final String accessToken;
  final String refreshToken;

  /// Vida del access token en segundos (900 = 15 min con la config actual).
  final int expiresIn;

  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
  });

  factory AuthTokens.fromJson(Map<String, dynamic> json) => AuthTokens(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        expiresIn: (json['expiresIn'] as num?)?.toInt() ?? 0,
      );
}

/// Usuario autenticado, tal y como lo devuelve `GET /auth/me`.
class UserProfile {
  final String id;
  final String email;
  final String? fullName;
  final String role; // CLIENT · PROVIDER · ADMIN

  const UserProfile({
    required this.id,
    required this.email,
    required this.role,
    this.fullName,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
        id: json['id'] as String,
        email: json['email'] as String,
        fullName: json['fullName'] as String?,
        role: json['role'] as String? ?? 'CLIENT',
      );

  String get displayName =>
      (fullName != null && fullName!.trim().isNotEmpty) ? fullName! : email;
}
