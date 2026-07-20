import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/providers.dart';
import 'features/auth/application/auth_controller.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/catalog/presentation/catalog_screen.dart';

void main() {
  runApp(const ProviderScope(child: LivioApp()));
}

class LivioApp extends StatelessWidget {
  const LivioApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF00696D);

    return MaterialApp(
      title: 'Livio',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: seed),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: seed,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const _Root(),
    );
  }
}

/// Decide qué pantalla toca según el estado de sesión.
class _Root extends ConsumerWidget {
  const _Root();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // El interceptor avisa cuando ni el refresh token sirve. Se escucha aquí,
    // en un solo sitio, en vez de que cada pantalla tenga que gestionar el caso
    // "me han echado a mitad de una operación".
    ref.listen<bool>(sessionExpiredProvider, (_, expired) {
      if (!expired) return;
      ref.read(sessionExpiredProvider.notifier).reset();
      ref.read(authControllerProvider.notifier).signOut(
            message: 'Tu sesión caducó. Vuelve a entrar.',
          );
    });

    return switch (ref.watch(authControllerProvider)) {
      AuthUnknown() => const _Splash(),
      AuthSignedIn(:final user) => CatalogScreen(user: user),
      _ => const LoginScreen(),
    };
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
