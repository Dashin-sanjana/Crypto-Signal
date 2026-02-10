import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class TradingChartWidget extends StatefulWidget {
  final String symbol;
  const TradingChartWidget({super.key, required this.symbol});

  @override
  State<TradingChartWidget> createState() => _TradingChartWidgetState();
}

class _TradingChartWidgetState extends State<TradingChartWidget> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..loadHtmlString(_getHtml(widget.symbol));
  }

  @override
  void didUpdateWidget(TradingChartWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.symbol != widget.symbol) {
      _controller.loadHtmlString(_getHtml(widget.symbol));
    }
  }

  String _getHtml(String symbol) {
    return '''
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; background: #000; height: 100vh; }
            #chart { height: 100%; }
          </style>
        </head>
        <body>
          <div id="chart"></div>
          <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
          <script type="text/javascript">
            new TradingView.widget({
              "autosize": true,
              "symbol": "BINANCE:$symbol",
              "interval": "5",
              "timezone": "Etc/UTC",
              "theme": "dark",
              "style": "2",
              "locale": "en",
              "toolbar_bg": "#f1f3f6",
              "enable_publishing": false,
              "allow_symbol_change": true,
              "container_id": "chart"
            });
          </script>
        </body>
      </html>
    ''';
  }

  @override
  Widget build(BuildContext context) {
    return WebViewWidget(controller: _controller);
  }
}
