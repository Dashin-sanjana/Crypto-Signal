import 'package:json_annotation/json_annotation.dart';

part 'price_data.g.dart';

@JsonSerializable()
class PriceData {
  final String symbol;
  final double price;
  final double change24h;
  final double high24h;
  final double low24h;
  final double volume24h;
  final int lastUpdate;

  PriceData({
    required this.symbol,
    required this.price,
    required this.change24h,
    required this.high24h,
    required this.low24h,
    required this.volume24h,
    required this.lastUpdate,
  });

  factory PriceData.fromJson(Map<String, dynamic> json) => _$PriceDataFromJson(json);
  Map<String, dynamic> toJson() => _$PriceDataToJson(this);
}
