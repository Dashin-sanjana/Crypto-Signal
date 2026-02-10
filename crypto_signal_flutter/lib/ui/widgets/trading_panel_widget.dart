import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/trading_provider.dart';

class TradingPanelWidget extends ConsumerWidget {
  const TradingPanelWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tradingState = ref.watch(tradingProvider);

    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'AUTO TRADING',
                style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white54),
              ),
              Switch(
                value: tradingState.autoTradingEnabled,
                onChanged: (val) => ref.read(tradingProvider.notifier).setAutoTrading(val),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildStatusRow('Connection', tradingState.isConnected ? 'Connected' : 'Disconnected', 
              tradingState.isConnected ? Colors.green : Colors.red),
          if (tradingState.riskStatus != null) ...[
            const SizedBox(height: 8),
            _buildStatusRow('Daily PnL', '\$${tradingState.riskStatus!['dailyPnL']}', 
                (tradingState.riskStatus!['dailyPnL'] ?? 0) >= 0 ? Colors.green : Colors.red),
          ],
          const SizedBox(height: 24),
          const Text(
            'OPEN POSITIONS',
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white54),
          ),
          const SizedBox(height: 8),
          if (tradingState.openTrades.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Center(child: Text('No open positions', style: TextStyle(color: Colors.white38))),
            )
          else
            ...tradingState.openTrades.map((trade) => _buildTradeRow(trade)),
        ],
      ),
    );
  }

  Widget _buildStatusRow(String label, String value, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 13)),
        Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }

  Widget _buildTradeRow(dynamic trade) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(trade['symbol'], style: const TextStyle(fontWeight: FontWeight.bold)),
                Text(trade['side'], style: TextStyle(color: trade['side'] == 'BUY' ? Colors.green : Colors.red, fontSize: 10)),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('\$${trade['price']}'),
                Text('Qty: ${trade['quantity']}', style: const TextStyle(fontSize: 10, color: Colors.white54)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
