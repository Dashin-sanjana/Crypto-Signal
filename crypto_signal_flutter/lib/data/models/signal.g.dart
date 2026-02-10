// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'signal.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Signal _$SignalFromJson(Map<String, dynamic> json) => Signal(
  id: json['id'] as String,
  type: json['type'] as String,
  symbol: json['symbol'] as String,
  entry: (json['entry'] as num).toDouble(),
  stopLoss: (json['stopLoss'] as num).toDouble(),
  takeProfit: (json['takeProfit'] as num).toDouble(),
  strength: (json['strength'] as num).toDouble(),
  timestamp: (json['timestamp'] as num).toInt(),
  expiresAt: (json['expiresAt'] as num).toInt(),
  status: json['status'] as String,
  confluence: json['confluence'] as Map<String, dynamic>?,
);

Map<String, dynamic> _$SignalToJson(Signal instance) => <String, dynamic>{
  'id': instance.id,
  'type': instance.type,
  'symbol': instance.symbol,
  'entry': instance.entry,
  'stopLoss': instance.stopLoss,
  'takeProfit': instance.takeProfit,
  'strength': instance.strength,
  'timestamp': instance.timestamp,
  'expiresAt': instance.expiresAt,
  'status': instance.status,
  'confluence': instance.confluence,
};
