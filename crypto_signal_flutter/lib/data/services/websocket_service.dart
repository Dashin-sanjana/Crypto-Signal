import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../../core/constants.dart';
import '../models/price_data.dart';

class WebSocketService {
  WebSocketChannel? _channel;
  
  Stream<PriceData> connectToTicker(String symbol) {
    final streamName = '${symbol.toLowerCase()}@ticker';
    _channel = WebSocketChannel.connect(
      Uri.parse('${AppConstants.binanceWsBase}/$streamName'),
    );
    
    return _channel!.stream.map((event) {
      final data = json.decode(event);
      return PriceData(
        symbol: data['s'],
        price: double.parse(data['c']),
        change24h: double.parse(data['P']),
        high24h: double.parse(data['h']),
        low24h: double.parse(data['l']),
        volume24h: double.parse(data['v']),
        lastUpdate: DateTime.now().millisecondsSinceEpoch,
      );
    });
  }

  void dispose() {
    _channel?.sink.close();
  }
}
