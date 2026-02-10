const dotenv = require('dotenv');
const path = require('path');
const { BinanceService } = require('./server/binanceService.cjs');

dotenv.config();

async function testDryRun() {
    const binance = new BinanceService();
    console.log('--- Testing Dry Run Order ---');
    console.log('Using Testnet:', binance.isTestnet());
    console.log('Dry Run Enabled:', binance.isDryRun());
    
    try {
        const order = await binance.placeOrder({
            symbol: 'BTCUSDT',
            side: 'BUY',
            type: 'MARKET',
            quantity: 0.1
        });
        console.log('Order Result:', order);
        
        if (order.orderId.startsWith('Simulated-')) {
            console.log('SUCCESS: Dry run correctly intercepted the order!');
        } else {
            console.warn('WARNING: Order might have been sent to Binance!');
        }
    } catch (error) {
        console.error('Failed to place order:', error.message);
    }
}

testDryRun();
