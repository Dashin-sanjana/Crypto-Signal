import 'package:json_annotation/json_annotation.dart';

part 'candle.g.dart';

@JsonSerializable()
class Candle {
  final double time;
  final double open;
  final double high;
  final double low;
  final double close;
  final double volume;

  Candle({
    required this.time,
    required this.open,
    required this.high,
    required this.low,
    required this.close,
    required this.volume,
  });

  factory Candle.fromJson(Map<String, dynamic> json) => _$CandleFromJson(json);
  Map<String, dynamic> toJson() => _$CandleToJson(this);
}
