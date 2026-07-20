import 'package:flutter_test/flutter_test.dart';
import 'package:livio_client/features/catalog/domain/service_item.dart';

void main() {
  group('ServiceItem.fromJson', () {
    test('acepta price como String, que es lo que envía el backend', () {
      // TypeORM serializa las columnas `numeric` de Postgres como String para
      // no perder precisión al pasar por el double de JavaScript. Si esto se
      // rompe, el catálogo muestra todos los precios a 0 sin fallar en ningún
      // sitio — el peor tipo de bug.
      final item = ServiceItem.fromJson(const {
        'id': 'a1',
        'providerId': 'p1',
        'name': 'Reparación de fuga',
        'price': '150.00',
        'category': 'PLOMERIA',
      });

      expect(item.price, 150.0);
    });

    test('acepta price como num por si el backend añade un transformer', () {
      final item = ServiceItem.fromJson(const {
        'id': 'a2',
        'providerId': 'p1',
        'name': 'Instalación eléctrica',
        'price': 89.5,
        'category': 'ELECTRICIDAD',
      });

      expect(item.price, 89.5);
    });

    test('no revienta con campos opcionales ausentes o nulos', () {
      final item = ServiceItem.fromJson(const {
        'id': 'a3',
        'providerId': 'p1',
        'name': 'Limpieza',
        'price': '40',
        'category': 'LIMPIEZA',
        'description': null,
        'imageUrl': null,
      });

      expect(item.description, isNull);
      expect(item.imageUrl, isNull);
      expect(item.price, 40.0);
    });

    test('un price ilegible cae a 0 en vez de lanzar', () {
      final item = ServiceItem.fromJson(const {
        'id': 'a4',
        'providerId': 'p1',
        'name': 'Raro',
        'price': 'no-es-un-numero',
        'category': 'OTROS',
      });

      expect(item.price, 0);
    });
  });
}
