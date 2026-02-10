import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/signal.dart';
import '../data/services/binance_service.dart';
import '../data/services/analysis_service.dart';
import '../core/constants.dart';
import 'price_provider.dart';

class SignalState {
  final List<Signal> activeSignals;
  final List<Signal> signalHistory;
  final bool isScanning;

  SignalState({
    required this.activeSignals,
    required this.signalHistory,
    required this.isScanning,
  });

  SignalState copyWith({
    List<Signal>? activeSignals,
    List<Signal>? signalHistory,
    bool? isScanning,
  }) {
    return SignalState(
      activeSignals: activeSignals ?? this.activeSignals,
      signalHistory: signalHistory ?? this.signalHistory,
      isScanning: isScanning ?? this.isScanning,
    );
  }
}

class SignalNotifier extends StateNotifier<SignalState> {
  final BinanceService _binanceService;
  Timer? _scanTimer;

  SignalNotifier(this._binanceService)
      : super(SignalState(
          activeSignals: [],
          signalHistory: [],
          isScanning: false,
        ));

  void addSignal(Signal signal) {
    if (state.activeSignals.any((s) => s.symbol == signal.symbol && s.type == signal.type)) {
      return;
    }
    state = state.copyWith(
      activeSignals: [signal, ...state.activeSignals],
      signalHistory: [signal, ...state.signalHistory].take(100).toList(),
    );
  }

  void removeSignal(String id) {
    state = state.copyWith(
      activeSignals: state.activeSignals.where((s) => s.id != id).toList(),
    );
  }

  Future<void> scanMarkets() async {
    if (state.isScanning) return;
    state = state.copyWith(isScanning: true);

    try {
      for (final item in AppConstants.watchlist) {
        final symbol = item['symbol']!;
        final candles = await _binanceService.fetchKlineData(symbol, interval: '15m', limit: 100);
        
        if (candles.length < 50) continue;

        // Ported analysis logic
        final rsiValues = AnalysisService.calculateRSI(candles);
        if (rsiValues.isEmpty) continue;
        final rsi = rsiValues.last;

        if (rsi < 30 || rsi > 70) {
          final type = rsi < 30 ? 'LONG' : 'SHORT';
          final entry = candles.last.close;
          final signal = Signal(
            id: DateTime.now().millisecondsSinceEpoch.toString(),
            symbol: symbol,
            type: type,
            entry: entry,
            stopLoss: type == 'LONG' ? entry * 0.98 : entry * 1.02,
            takeProfit: type == 'LONG' ? entry * 1.05 : entry * 0.95,
            strength: 75,
            timestamp: DateTime.now().millisecondsSinceEpoch,
            expiresAt: DateTime.now().millisecondsSinceEpoch + (15 * 60 * 1000), // 15 mins
            status: 'active',
          );
          addSignal(signal);
        }
      }
    } finally {
      state = state.copyWith(isScanning: false);
    }
  }

  void startAutoScan() {
    _scanTimer?.cancel();
    _scanTimer = Timer.periodic(const Duration(minutes: 5), (_) => scanMarkets());
    scanMarkets(); // Initial scan
  }

  void stopAutoScan() {
    _scanTimer?.cancel();
    _scanTimer = null;
  }

  @override
  void dispose() {
    _scanTimer?.cancel();
    super.dispose();
  }
}

final signalProvider = StateNotifierProvider<SignalNotifier, SignalState>((ref) {
  final notifier = SignalNotifier(ref.watch(binanceServiceProvider));
  return notifier;
});
