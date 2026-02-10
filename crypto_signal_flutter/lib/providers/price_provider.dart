import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/candle.dart';
import '../data/models/price_data.dart';
import '../data/services/binance_service.dart';
import '../data/services/websocket_service.dart';
import '../data/services/analysis_service.dart';
import '../core/constants.dart';

final binanceServiceProvider = Provider((ref) => BinanceService());
final webSocketServiceProvider = Provider((ref) => WebSocketService());

class PriceState {
  final Map<String, PriceData> prices;
  final Map<String, List<Candle>> priceHistory;
  final String selectedSymbol;
  final String timeframe;
  final bool isConnected;
  final Map<String, dynamic> recommendation;
  final Map<String, String> indicatorStatus;
  final double? tp;
  final double? sl;

  PriceState({
    required this.prices,
    required this.priceHistory,
    required this.selectedSymbol,
    required this.timeframe,
    required this.isConnected,
    required this.recommendation,
    required this.indicatorStatus,
    this.tp,
    this.sl,
  });

  PriceState copyWith({
    Map<String, PriceData>? prices,
    Map<String, List<Candle>>? priceHistory,
    String? selectedSymbol,
    String? timeframe,
    bool? isConnected,
    Map<String, dynamic>? recommendation,
    Map<String, String>? indicatorStatus,
    double? tp,
    double? sl,
  }) {
    return PriceState(
      prices: prices ?? this.prices,
      priceHistory: priceHistory ?? this.priceHistory,
      selectedSymbol: selectedSymbol ?? this.selectedSymbol,
      timeframe: timeframe ?? this.timeframe,
      isConnected: isConnected ?? this.isConnected,
      recommendation: recommendation ?? this.recommendation,
      indicatorStatus: indicatorStatus ?? this.indicatorStatus,
      tp: tp ?? this.tp,
      sl: sl ?? this.sl,
    );
  }
}

class PriceNotifier extends StateNotifier<PriceState> {
  final BinanceService _binanceService;
  final WebSocketService _wsService;
  final Map<String, StreamSubscription> _subscriptions = {};

  PriceNotifier(this._binanceService, this._wsService)
      : super(PriceState(
          prices: {},
          priceHistory: {},
          selectedSymbol: AppConstants.watchlist[0]['symbol']!,
          timeframe: '5m',
          isConnected: false,
          recommendation: {'action': 'NEUTRAL', 'confidence': 0, 'reasons': []},
          indicatorStatus: {},
          tp: null,
          sl: null,
        )) {
    _init();
  }

  void _init() {
    for (final item in AppConstants.watchlist) {
      final symbol = item['symbol']!;
      _connectToSymbol(symbol);
      _fetchInitialHistory(symbol);
    }
  }

  void _connectToSymbol(String symbol) {
    _subscriptions[symbol] = _wsService.connectToTicker(symbol).listen((data) {
      final history = state.priceHistory[symbol] ?? [];
      
      Map<String, dynamic> rec = state.recommendation;
      Map<String, String> status = state.indicatorStatus;
      
      if (symbol == state.selectedSymbol && history.length >= 50) {
        final signal = AnalysisService.calculateTechnicalSignal(history);
        rec = signal;
        status = Map<String, String>.from(signal['status']);
      }

      state = state.copyWith(
        prices: {...state.prices, symbol: data},
        isConnected: true,
        recommendation: rec,
        indicatorStatus: status,
        tp: rec['action'].contains('BUY') ? data.price * 1.05 : (rec['action'].contains('SELL') ? data.price * 0.95 : null),
        sl: rec['action'].contains('BUY') ? data.price * 0.98 : (rec['action'].contains('SELL') ? data.price * 1.02 : null),
      );
    });
  }

  Future<void> _fetchInitialHistory(String symbol) async {
    final history = await _binanceService.fetchKlineData(symbol, interval: state.timeframe);
    state = state.copyWith(
      priceHistory: {...state.priceHistory, symbol: history},
    );
  }

  void selectSymbol(String symbol) {
    state = state.copyWith(selectedSymbol: symbol);
  }

  void setTimeframe(String timeframe) {
    state = state.copyWith(timeframe: timeframe);
    _fetchInitialHistory(state.selectedSymbol);
  }

  @override
  void dispose() {
    for (final sub in _subscriptions.values) {
      sub.cancel();
    }
    _wsService.dispose();
    super.dispose();
  }
}

final priceProvider = StateNotifierProvider<PriceNotifier, PriceState>((ref) {
  return PriceNotifier(
    ref.watch(binanceServiceProvider),
    ref.watch(webSocketServiceProvider),
  );
});
