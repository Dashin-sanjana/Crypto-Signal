class AppConstants {
  static const String binanceApiBase = 'https://api.binance.com/api/v3';
  static const String binanceWsBase = 'wss://stream.binance.com:9443/ws';
  static const String tradingApiUrl = 'http://localhost:3001';
  
  static const List<Map<String, String>> watchlist = [
    {'symbol': 'BTCUSDT', 'name': 'Bitcoin', 'ticker': 'BTC'},
    {'symbol': 'ETHUSDT', 'name': 'Ethereum', 'ticker': 'ETH'},
    {'symbol': 'SOLUSDT', 'name': 'Solana', 'ticker': 'SOL'},
    {'symbol': 'BNBUSDT', 'name': 'Binance Coin', 'ticker': 'BNB'},
    {'symbol': 'XRPUSDT', 'name': 'Ripple', 'ticker': 'XRP'},
  ];
}
