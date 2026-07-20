import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/service_item.dart';

class CatalogRepository {
  final ApiClient _api;

  CatalogRepository(this._api);

  /// `GET /api/services` — **ruta pública** en Kong: el cliente explora el
  /// catálogo antes de registrarse. Que funcione sin token es intencionado, no
  /// un descuido, y es uno de los cuatro criterios del piloto.
  Future<List<ServiceItem>> fetchServices() async {
    final response = await _api.dio.get<Map<String, dynamic>>('/services');
    final rows = response.data?['data'] as List<dynamic>? ?? const [];
    return rows
        .whereType<Map<String, dynamic>>()
        .map(ServiceItem.fromJson)
        .toList(growable: false);
  }

  /// `GET /api/orders` — **ruta protegida**: aquí el JWT lo exige Kong, no el
  /// microservicio. Sirve para comprobar que el token que emitió auth-service
  /// es aceptado por el gateway, que es justo la integración que valida la
  /// Fase 1. Devuelve el código HTTP en vez de los datos porque lo que
  /// interesa es si pasó la puerta, no qué había detrás.
  Future<int> probeProtectedRoute() async {
    try {
      final response = await _api.dio.get<dynamic>('/orders');
      return response.statusCode ?? 0;
    } on DioException catch (e) {
      return e.response?.statusCode ?? 0;
    }
  }
}
