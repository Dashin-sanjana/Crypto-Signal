import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme.dart';
import 'ui/screens/dashboard_screen.dart';

void main() {
  runApp(
    const ProviderScope(
      child: CryptoSignalApp(),
    ),
  );
}

class CryptoSignalApp extends StatelessWidget {
  const CryptoSignalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Crypto Signal Dashboard',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: const DashboardScreen(),
    );
  }
}
