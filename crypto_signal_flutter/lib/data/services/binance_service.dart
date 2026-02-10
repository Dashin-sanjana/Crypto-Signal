import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/candle.dart';
import '../../core/constants.dart';

class BinanceService {
  Future<List<Map<String, dynamic>>> fetchSymbols() async {
    try {
      final response = await http.get(Uri.parse('${AppConstants.binanceApiBase}/exchangeInfo'));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final symbols = (data['symbols'] as List)
            .filter((s) => s['quoteAsset'] == 'USDT' && s['status'] == 'TRADING')
            .map((s) => {
                  'symbol': s['symbol'],
                  'baseAsset': s['baseAsset'],
                  'quoteAsset': s['quoteAsset'],
                })
            .toList();
        return symbols;
      }
    } catch (e) {
      // Handle error
    }
    return [];
  }

  Future<List<Candle>> fetchKlineData(String symbol, {String interval = '5m', int limit = 500}) async {
    try {
      final response = await http.get(
        Uri.parse('${AppConstants.binanceApiBase}/klines?symbol=$symbol&interval=$interval&limit=$limit'),
      );
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((candle) => Candle(
          time: candle[0] / 1000.0,
          open: double.parse(candle[1]),
          high: double.parse(candle[2]),
          low: double.parse(candle[3]),
          close: double.parse(candle[4]),
          volume: double.parse(candle[5]),
        )).toList();
      }
    } catch (e) {
      // Handle error
    }
    return [];
  }
}

extension ListFilter<T> on List<T> {
  Iterable<T> filter(bool Function(T) test) => where(test);
}
