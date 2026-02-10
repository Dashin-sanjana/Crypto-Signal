import 'package:flutter/material.dart';

class NewsPanelWidget extends StatelessWidget {
  const NewsPanelWidget({super.key});

  @override
  Widget build(BuildContext context) {
    // Mock data for now, similar to React implementation
    final news = [
      {
        'title': 'Bitcoin Surges Past \$50,000 as Institutional Adoption Grows',
        'source': 'CoinDesk',
        'sentiment': 'bullish'
      },
      {
        'title': 'Regulatory Concerns Impact Crypto Market Sentiment',
        'source': 'Decrypt',
        'sentiment': 'bearish'
      },
      {
        'title': 'Ethereum Network Upgrade Shows Promising Results',
        'source': 'Cointelegraph',
        'sentiment': 'bullish'
      },
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'LATEST NEWS',
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white54),
          ),
          const SizedBox(height: 16),
          ...news.map((item) => Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            item['source']!,
                            style: const TextStyle(fontSize: 10, color: Color(0xFF6366f1)),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: item['sentiment'] == 'bullish' ? Colors.green.withValues(alpha: 0.1) : Colors.red.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              item['sentiment']!.toUpperCase(),
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                                color: item['sentiment'] == 'bullish' ? Colors.green : Colors.red,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        item['title']!,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              )),
        ],
      ),
    );
  }
}
