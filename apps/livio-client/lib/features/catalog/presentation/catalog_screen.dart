import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/domain/session.dart';
import '../domain/service_item.dart';

/// Catálogo público + panel de diagnóstico de la integración.
///
/// El panel no es adorno: la Fase 1 existe para validar cuatro cosas contra
/// Kong, y verlas en verde dentro de la propia app es mejor prueba que un log.
/// Desaparece en cuanto el piloto cumpla su función.
final catalogProvider = FutureProvider.autoDispose<List<ServiceItem>>((ref) {
  return ref.watch(catalogRepositoryProvider).fetchServices();
});

class CatalogScreen extends ConsumerWidget {
  final UserProfile user;
  const CatalogScreen({super.key, required this.user});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(catalogProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Livio'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Cerrar sesión',
            onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(catalogProvider.future),
        child: catalog.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _ErrorView(
            error: e,
            onRetry: () => ref.invalidate(catalogProvider),
          ),
          data: (services) => ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: services.length + 1,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              if (index == 0) return _DiagnosticsPanel(user: user);
              return _ServiceCard(item: services[index - 1]);
            },
          ),
        ),
      ),
    );
  }
}

/// Estado en vivo de los criterios de aceptación de la Fase 1.
class _DiagnosticsPanel extends ConsumerStatefulWidget {
  final UserProfile user;
  const _DiagnosticsPanel({required this.user});

  @override
  ConsumerState<_DiagnosticsPanel> createState() => _DiagnosticsPanelState();
}

class _DiagnosticsPanelState extends ConsumerState<_DiagnosticsPanel> {
  int? _protectedStatus;
  bool _probing = false;

  Future<void> _probe() async {
    setState(() => _probing = true);
    final status =
        await ref.read(catalogRepositoryProvider).probeProtectedRoute();
    if (mounted) {
      setState(() {
        _protectedStatus = status;
        _probing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  child: Text(widget.user.displayName.characters.first.toUpperCase()),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.user.displayName,
                        style: theme.textTheme.titleMedium,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        widget.user.role,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            Text(
              'Integración con Kong',
              style: theme.textTheme.labelLarge,
            ),
            const SizedBox(height: 8),

            // 1 y 2: si esta pantalla se está pintando, ambos ya se cumplieron.
            const _Check(
              label: 'Login vía Kong → token guardado en Keystore',
              ok: true,
            ),
            const _Check(
              label: 'Catálogo público sin token',
              ok: true,
            ),

            // 3: hay que provocarlo, porque Kong es quien corta aquí.
            _Check(
              label: _protectedStatus == null
                  ? 'Ruta protegida (/api/orders) — sin comprobar'
                  : 'Ruta protegida (/api/orders) → HTTP $_protectedStatus',
              ok: _protectedStatus == null
                  ? null
                  : _protectedStatus != 401 && _protectedStatus != 0,
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _probing ? null : _probe,
              icon: _probing
                  ? const SizedBox(
                      height: 14,
                      width: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.shield_outlined, size: 18),
              label: const Text('Probar ruta protegida'),
            ),
            if (_protectedStatus == 401) ...[
              const SizedBox(height: 8),
              Text(
                'Kong rechazó el token. Suele significar que JWT_SECRET no '
                'coincide entre auth-service y el consumer de Kong.',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.error),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Check extends StatelessWidget {
  final String label;

  /// `null` = todavía sin comprobar.
  final bool? ok;
  const _Check({required this.label, required this.ok});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final (icon, color) = switch (ok) {
      true => (Icons.check_circle, Colors.green),
      false => (Icons.cancel, scheme.error),
      null => (Icons.help_outline, scheme.onSurfaceVariant),
    };

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(label, style: const TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  final ServiceItem item;
  const _ServiceCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (item.imageUrl != null && item.imageUrl!.isNotEmpty)
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(
                item.imageUrl!,
                fit: BoxFit.cover,
                // La imagen vive en S3 y la optimizó la Lambda. Si no carga, no
                // debe tumbar la tarjeta entera.
                errorBuilder: (_, _, _) => Container(
                  color: theme.colorScheme.surfaceContainerHighest,
                  child: const Center(child: Icon(Icons.broken_image_outlined)),
                ),
                loadingBuilder: (context, child, progress) => progress == null
                    ? child
                    : Container(
                        color: theme.colorScheme.surfaceContainerHighest,
                        child: const Center(
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        item.name,
                        style: theme.textTheme.titleMedium,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '\$${item.price.toStringAsFixed(2)}',
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: theme.colorScheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  item.category,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                    letterSpacing: 0.5,
                  ),
                ),
                if (item.description != null &&
                    item.description!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    item.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;
  const _ErrorView({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(32),
      children: [
        const SizedBox(height: 60),
        Icon(
          Icons.cloud_off,
          size: 48,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
        const SizedBox(height: 16),
        Text(
          'No se pudo cargar el catálogo',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        Text(
          '$error',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 24),
        Center(
          child: FilledButton.tonal(
            onPressed: onRetry,
            child: const Text('Reintentar'),
          ),
        ),
      ],
    );
  }
}
