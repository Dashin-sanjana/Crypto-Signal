import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/price_provider.dart';
import '../widgets/consensus_gauge_widget.dart';

class TechnicalAnalysisWidget extends ConsumerWidget {
  const TechnicalAnalysisWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final priceState = ref.watch(priceProvider);
    final rec = priceState.recommendation;
    final status = priceState.indicatorStatus;

    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'TECHNICAL ANALYSIS',
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white54),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      Text(
                        rec['action'] ?? 'NEUTRAL',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: _getActionColor(rec['action']),
                        ),
                      ),
                      Text(
                        'Confidence: ${rec['confidence']}%',
                        style: const TextStyle(color: Colors.white54),
                      ),
                    ],
                  ),
                ),
              ),
              if (priceState.tp != null || priceState.sl != null) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: [
                        if (priceState.tp != null)
                          _buildPriceValue('TP', priceState.tp!, Colors.green),
                        if (priceState.tp != null && priceState.sl != null)
                          const SizedBox(height: 8),
                        if (priceState.sl != null)
                          _buildPriceValue('SL', priceState.sl!, Colors.red),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),
          ConsensusGaugeWidget(symbol: priceState.selectedSymbol),
          const SizedBox(height: 16),
          const Text(
            'INDICATORS',
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white54, fontSize: 12),
          ),
          const SizedBox(height: 8),
          ...status.entries.map((e) => _buildIndicatorRow(e.key, e.value)),
          if (rec['reasons'] != null && (rec['reasons'] as List).isNotEmpty) ...[
            const SizedBox(height: 24),
            const Text(
              'REASONS',
              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white54, fontSize: 12),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: (rec['reasons'] as List<dynamic>)
                  .map((reason) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white10),
                        ),
                        child: Text(
                          reason.toString(),
                          style: const TextStyle(fontSize: 12, color: Colors.white70),
                        ),
                      ))
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPriceValue(String label, double value, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white54, fontSize: 12)),
        Text(
          '\$${value.toStringAsFixed(2)}',
          style: TextStyle(color: color, fontWeight: FontWeight.bold),
        ),
      ],
    );
  }

  Color _getActionColor(String? action) {
    if (action == null) return Colors.grey;
    if (action.contains('BUY')) return Colors.green;
    if (action.contains('SELL')) return Colors.red;
    return Colors.grey;
  }

  Widget _buildIndicatorRow(String name, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(name),
          Text(
            value.toUpperCase(),
            style: TextStyle(
              color: value == 'bullish' ? Colors.green : value == 'bearish' ? Colors.red : Colors.grey,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
