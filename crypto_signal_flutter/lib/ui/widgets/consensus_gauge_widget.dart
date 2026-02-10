import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class ConsensusGaugeWidget extends StatefulWidget {
  final String symbol;
  const ConsensusGaugeWidget({super.key, required this.symbol});

  @override
  State<ConsensusGaugeWidget> createState() => _ConsensusGaugeWidgetState();
}

class _ConsensusGaugeWidgetState extends State<ConsensusGaugeWidget> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.transparent)
      ..loadHtmlString(_getHtml(widget.symbol));
  }

  @override
  void didUpdateWidget(ConsensusGaugeWidget oldWidget) {
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
            body { margin: 0; background: transparent; overflow: hidden; display: flex; justify-content: center; align-items: center; height: 100vh; }
            .tradingview-widget-container { width: 100%; height: 100%; display: flex; justify-content: center; }
          </style>
        </head>
        <body>
          <div class="tradingview-widget-container">
            <div class="tradingview-widget-container__widget"></div>
            <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js" async>
            {
              "interval": "1m",
              "width": "100%",
              "isTransparent": true,
              "height": "100%",
              "symbol": "BINANCE:$symbol",
              "showIntervalTabs": true,
              "locale": "en",
              "colorTheme": "dark"
            }
            </script>
          </div>
        </body>
      </html>
    ''';
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 480,
      child: WebViewWidget(controller: _controller),
    );
  }
}
