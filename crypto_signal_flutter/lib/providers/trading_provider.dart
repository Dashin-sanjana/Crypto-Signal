import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class TradingState {
  final bool autoTradingEnabled;
  final bool isConnected;
  final List<dynamic> openTrades;
  final List<dynamic> tradeHistory;
  final Map<String, dynamic>? riskStatus;

  TradingState({
    required this.autoTradingEnabled,
    required this.isConnected,
    required this.openTrades,
    required this.tradeHistory,
    this.riskStatus,
  });

  TradingState copyWith({
    bool? autoTradingEnabled,
    bool? isConnected,
    List<dynamic>? openTrades,
    List<dynamic>? tradeHistory,
    Map<String, dynamic>? riskStatus,
  }) {
    return TradingState(
      autoTradingEnabled: autoTradingEnabled ?? this.autoTradingEnabled,
      isConnected: isConnected ?? this.isConnected,
      openTrades: openTrades ?? this.openTrades,
      tradeHistory: tradeHistory ?? this.tradeHistory,
      riskStatus: riskStatus ?? this.riskStatus,
    );
  }
}

class TradingNotifier extends StateNotifier<TradingState> {
  final String _apiUrl = 'http://localhost:3001'; // Default, should be configurable
  Timer? _refreshTimer;

  TradingNotifier()
      : super(TradingState(
          autoTradingEnabled: false,
          isConnected: false,
          openTrades: [],
          tradeHistory: [],
        )) {
    _init();
  }

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    state = state.copyWith(
      autoTradingEnabled: prefs.getBool('auto_trading_enabled') ?? false,
    );
    checkHealth();
    startPeriodicRefresh();
  }

  Future<void> checkHealth() async {
    try {
      final response = await http.get(Uri.parse('$_apiUrl/health')).timeout(const Duration(seconds: 5));
      state = state.copyWith(isConnected: response.statusCode == 200);
    } catch (_) {
      state = state.copyWith(isConnected: false);
    }
  }

  Future<void> refreshStatus() async {
    if (!state.isConnected) return;
    try {
      final responses = await Future.wait([
        http.get(Uri.parse('$_apiUrl/api/risk-status')),
        http.get(Uri.parse('$_apiUrl/api/trades')),
        http.get(Uri.parse('$_apiUrl/api/open-trades')),
      ]);

      if (responses.every((r) => r.statusCode == 200)) {
        state = state.copyWith(
          riskStatus: json.decode(responses[0].body),
          tradeHistory: json.decode(responses[1].body),
          openTrades: json.decode(responses[2].body),
        );
      }
    } catch (e) {
      // Handle error
    }
  }

  void setAutoTrading(bool enabled) async {
    state = state.copyWith(autoTradingEnabled: enabled);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('auto_trading_enabled', enabled);
  }

  void startPeriodicRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) => refreshStatus());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }
}

final tradingProvider = StateNotifierProvider<TradingNotifier, TradingState>((ref) {
  return TradingNotifier();
});
