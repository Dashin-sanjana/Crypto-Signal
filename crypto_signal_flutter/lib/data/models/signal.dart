import 'package:json_annotation/json_annotation.dart';

part 'signal.g.dart';

@JsonSerializable()
class Signal {
  final String id;
  final String type; // 'LONG' or 'SHORT'
  final String symbol;
  final double entry;
  final double stopLoss;
  final double takeProfit;
  final double strength;
  final int timestamp;
  final int expiresAt;
  final String status; // 'active', 'closed', 'expired'
  final Map<String, dynamic>? confluence;

  Signal({
    required this.id,
    required this.type,
    required this.symbol,
    required this.entry,
    required this.stopLoss,
    required this.takeProfit,
    required this.strength,
    required this.timestamp,
    required this.expiresAt,
    required this.status,
    this.confluence,
  });

  factory Signal.fromJson(Map<String, dynamic> json) => _$SignalFromJson(json);
  Map<String, dynamic> toJson() => _$SignalToJson(this);
}
