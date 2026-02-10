// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'news.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NewsItem _$NewsItemFromJson(Map<String, dynamic> json) => NewsItem(
  id: json['id'] as String,
  title: json['title'] as String,
  description: json['description'] as String,
  source: json['source'] as String,
  url: json['url'] as String,
  timestamp: (json['timestamp'] as num).toInt(),
  sentiment: json['sentiment'] as String,
);

Map<String, dynamic> _$NewsItemToJson(NewsItem instance) => <String, dynamic>{
  'id': instance.id,
  'title': instance.title,
  'description': instance.description,
  'source': instance.source,
  'url': instance.url,
  'timestamp': instance.timestamp,
  'sentiment': instance.sentiment,
};
