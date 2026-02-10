import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class APIConfigScreen extends StatefulWidget {
  const APIConfigScreen({super.key});

  @override
  State<APIConfigScreen> createState() => _APIConfigScreenState();
}

class _APIConfigScreenState extends State<APIConfigScreen> {
  final _apiKeyController = TextEditingController();
  final _secretKeyController = TextEditingController();
  bool _isTestnet = true;

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  Future<void> _loadConfig() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _apiKeyController.text = prefs.getString('binance_api_key') ?? '';
      _secretKeyController.text = prefs.getString('binance_secret_key') ?? '';
      _isTestnet = prefs.getBool('binance_testnet') ?? true;
    });
  }

  Future<void> _saveConfig() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('binance_api_key', _apiKeyController.text);
    await prefs.setString('binance_secret_key', _secretKeyController.text);
    await prefs.setBool('binance_testnet', _isTestnet);
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Configuration saved successfully!')),
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('API Configuration')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _apiKeyController,
              decoration: const InputDecoration(
                labelText: 'Binance API Key',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _secretKeyController,
              decoration: const InputDecoration(
                labelText: 'Binance Secret Key',
                border: OutlineInputBorder(),
              ),
              obscureText: true,
            ),
            const SizedBox(height: 16),
            SwitchListTile(
              title: const Text('Use Testnet'),
              value: _isTestnet,
              onChanged: (val) => setState(() => _isTestnet = val),
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: _saveConfig,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                backgroundColor: Theme.of(context).primaryColor,
              ),
              child: const Text('Save Configuration'),
            ),
          ],
        ),
      ),
    );
  }
}
