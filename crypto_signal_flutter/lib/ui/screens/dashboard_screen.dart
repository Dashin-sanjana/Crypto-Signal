import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/price_provider.dart';
import '../widgets/header_widget.dart';
import '../widgets/watchlist_widget.dart';
import '../widgets/trading_chart_widget.dart';
import '../widgets/technical_analysis_widget.dart';
import '../widgets/news_panel_widget.dart';
import '../widgets/trading_panel_widget.dart';
import 'api_config_screen.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final priceState = ref.watch(priceProvider);

    return LayoutBuilder(
      builder: (context, constraints) {
        final isMobile = constraints.maxWidth < 900;

        return Scaffold(
          drawer: isMobile
              ? const Drawer(
                  child: WatchlistWidget(),
                )
              : null,
          body: SafeArea(
            child: Column(
              children: [
                HeaderWidget(showMenu: isMobile),
                Expanded(
                  child: Row(
                    children: [
                      if (!isMobile)
                        const SizedBox(
                          width: 280,
                          child: WatchlistWidget(),
                        ),
                      if (!isMobile) const VerticalDivider(width: 1),
                      Expanded(
                        child: SingleChildScrollView(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              SizedBox(
                                height: isMobile ? 300 : 450,
                                child: TradingChartWidget(
                                  symbol: priceState.selectedSymbol,
                                ),
                              ),
                              const Divider(height: 1),
                              const TechnicalAnalysisWidget(),
                              const Divider(height: 1),
                              const TradingPanelWidget(),
                              if (isMobile) ...[
                                const Divider(height: 1),
                                const NewsPanelWidget(),
                              ],
                            ],
                          ),
                        ),
                      ),
                      if (!isMobile) ...[
                        const VerticalDivider(width: 1),
                        const SizedBox(
                          width: 320,
                          child: SingleChildScrollView(
                            child: NewsPanelWidget(),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          floatingActionButton: FloatingActionButton(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const APIConfigScreen()),
              );
            },
            child: const Icon(Icons.settings),
          ),
        );
      },
    );
  }
}
