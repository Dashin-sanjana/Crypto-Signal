import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/price_provider.dart';
import '../../core/constants.dart';

class WatchlistWidget extends ConsumerWidget {
  const WatchlistWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final priceState = ref.watch(priceProvider);

    return Container(
      color: Colors.black.withValues(alpha: 0.1),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.all(16.0),
            child: Text(
              'WATCHLIST',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                letterSpacing: 1,
                color: Colors.white54,
              ),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: AppConstants.watchlist.length,
              itemBuilder: (context, index) {
                final item = AppConstants.watchlist[index];
                final symbol = item['symbol']!;
                final priceData = priceState.prices[symbol];
                final isSelected = priceState.selectedSymbol == symbol;

                return InkWell(
                  onTap: () => ref.read(priceProvider.notifier).selectSymbol(symbol),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: isSelected ? Colors.white.withValues(alpha: 0.05) : null,
                      border: Border(left: BorderSide(
                        color: isSelected ? const Color(0xFF6366f1) : Colors.transparent,
                        width: 4,
                      )),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item['ticker']!, style: const TextStyle(fontWeight: FontWeight.bold)),
                            Text(item['name']!, style: const TextStyle(fontSize: 12, color: Colors.white54)),
                          ],
                        ),
                        if (priceData != null)
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('\$${priceData.price.toStringAsFixed(2)}'),
                              Text(
                                '${priceData.change24h > 0 ? '+' : ''}${priceData.change24h.toStringAsFixed(2)}%',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: priceData.change24h >= 0 ? Colors.green : Colors.red,
                                ),
                              ),
                            ],
                          )
                        else
                          const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
