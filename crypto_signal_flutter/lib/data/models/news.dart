import 'package:json_annotation/json_annotation.dart';

part 'news.g.dart';

@JsonSerializable()
class NewsItem {
  final String id;
  final String title;
  final String description;
  final String source;
  final String url;
  final int timestamp;
  final String sentiment; // 'bullish', 'bearish', 'neutral'

  NewsItem({
    required this.id,
    required this.title,
    required this.description,
    required this.source,
    required this.url,
    required this.timestamp,
    required this.sentiment,
  });

  factory NewsItem.fromJson(Map<String, dynamic> json) => _$NewsItemFromJson(json);
  Map<String, dynamic> toJson() => _$NewsItemToJson(this);
}
