/// Un servicio del catálogo.
class ServiceItem {
  final String id;
  final String providerId;
  final String name;
  final String? description;
  final double price;
  final String category;
  final String? imageUrl;

  const ServiceItem({
    required this.id,
    required this.providerId,
    required this.name,
    required this.price,
    required this.category,
    this.description,
    this.imageUrl,
  });

  factory ServiceItem.fromJson(Map<String, dynamic> json) => ServiceItem(
        id: json['id'] as String,
        providerId: json['providerId'] as String? ?? '',
        name: json['name'] as String? ?? 'Sin nombre',
        description: json['description'] as String?,
        price: _parsePrice(json['price']),
        category: json['category'] as String? ?? 'OTROS',
        imageUrl: json['imageUrl'] as String?,
      );

  /// `price` es una columna `numeric` de Postgres, y TypeORM la serializa como
  /// **String** para no perder precisión al pasar por el double de JavaScript.
  /// Es decir, llega `"150.00"`, no `150`. Aceptamos ambas formas: si algún día
  /// se añade un transformer en el backend, esto no se rompe.
  static double _parsePrice(Object? raw) {
    if (raw is num) return raw.toDouble();
    if (raw is String) return double.tryParse(raw) ?? 0;
    return 0;
  }
}
