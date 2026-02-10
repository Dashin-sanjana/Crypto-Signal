import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/price_provider.dart';

class HeaderWidget extends ConsumerWidget {
  final bool showMenu;
  const HeaderWidget({super.key, this.showMenu = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final priceState = ref.watch(priceProvider);
    final selectedPrice = priceState.prices[priceState.selectedSymbol];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        border: const Border(bottom: BorderSide(color: Colors.white10)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              if (showMenu)
                IconButton(
                  icon: const Icon(Icons.menu),
                  onPressed: () => Scaffold.of(context).openDrawer(),
                ),
              const Icon(Icons.analytics, color: Color(0xFF6366f1), size: 32),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'CRYPTO SIGNAL',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.2,
                    ),
                  ),
                  Text(
                    'AI Market Analysis Tool',
                    style: TextStyle(fontSize: 12, color: Colors.white54),
                  ),
                ],
              ),
            ],
          ),
          if (selectedPrice != null)
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  selectedPrice.symbol,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                Text(
                  '\$${selectedPrice.price.toStringAsFixed(2)}',
                  style: TextStyle(
                    color: selectedPrice.change24h >= 0 ? Colors.green : Colors.red,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
