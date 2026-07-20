/// Configuración de entorno, inyectada en tiempo de compilación.
///
/// Nunca se codifica una URL a fuego: la misma app corre contra el emulador, un
/// móvil por USB, la LAN o producción, y esos son cuatro valores distintos.
class AppConfig {
  const AppConfig._();

  /// Base de la API. **Siempre a través de Kong**, nunca a un microservicio
  /// directo: el gateway es quien valida el JWT y aplica el rate-limit, así que
  /// saltárselo daría una falsa sensación de que todo funciona.
  ///
  /// Cómo apuntar a tu backend según dónde corras la app:
  ///
  ///   Emulador Android → http://10.0.2.2:8000/api        (por defecto)
  ///     10.0.2.2 es el alias que el emulador da al localhost del PC.
  ///
  ///   Móvil por USB    → http://localhost:8000/api
  ///     Requiere `adb reverse tcp:8000 tcp:8000` con el móvil conectado.
  ///
  ///   Móvil por WiFi   → `http://<IP-LAN-del-PC>:8000/api`
  ///
  /// Ejemplo:
  ///   flutter run --dart-define=API_BASE_URL=http://192.168.1.40:8000/api
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api',
  );

  /// `true` cuando la API viaja sin cifrar. Solo debe ser cierto en desarrollo:
  /// se usa para mostrar un aviso visible en la propia app y que nadie confunda
  /// una build de pruebas con una real.
  static bool get isInsecureTransport => apiBaseUrl.startsWith('http://');

  /// Credenciales con las que precargar el formulario de login.
  ///
  /// **Vacías por defecto, a propósito.** Tener el usuario de prueba escrito en
  /// el código sería cómodo, pero esa cadena acabaría dentro del APK publicado:
  /// la app le aparecería a un usuario real con un formulario relleno con
  /// credenciales ajenas, y además quedaría una contraseña versionada en git.
  ///
  /// Quien quiera la comodidad en desarrollo la pide explícitamente:
  ///   flutter run --dart-define=DEV_EMAIL=... --dart-define=DEV_PASSWORD=...
  ///
  /// El usuario de prueba concreto está en el README, que es donde va la
  /// documentación de arranque — no incrustado en el código.
  static const String devEmail = String.fromEnvironment('DEV_EMAIL');
  static const String devPassword = String.fromEnvironment('DEV_PASSWORD');

  /// `true` si se pasaron credenciales de desarrollo. La UI lo usa para avisar
  /// de que el formulario viene precargado y no es magia.
  static bool get hasPrefilledCredentials => devEmail.isNotEmpty;
}
