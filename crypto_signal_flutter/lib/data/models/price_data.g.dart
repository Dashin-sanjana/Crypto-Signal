// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'price_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PriceData _$PriceDataFromJson(Map<String, dynamic> json) => PriceData(
  symbol: json['symbol'] as String,
  price: (json['price'] as num).toDouble(),
  change24h: (json['change24h'] as num).toDouble(),
  high24h: (json['high24h'] as num).toDouble(),
  low24h: (json['low24h'] as num).toDouble(),
  volume24h: (json['volume24h'] as num).toDouble(),
  lastUpdate: (json['lastUpdate'] as num).toInt(),
);

Map<String, dynamic> _$PriceDataToJson(PriceData instance) => <String, dynamic>{
  'symbol': instance.symbol,
  'price': instance.price,
  'change24h': instance.change24h,
  'high24h': instance.high24h,
  'low24h': instance.low24h,
  'volume24h': instance.volume24h,
  'lastUpdate': instance.lastUpdate,
};
