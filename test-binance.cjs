const dotenv = require('dotenv');
const path = require('path');
const { BinanceService } = require('./server/binanceService.cjs');

dotenv.config();

async function test() {
    const binance = new BinanceService();
    console.log('Testing Binance connection...');
    console.log('Using Testnet:', binance.isTestnet());
    
    try {
        const account = await binance.getAccountInfo();
        console.log('Successfully connected to Binance!');
        console.log('Account balances:', account.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0));
    } catch (error) {
        console.error('Failed to connect to Binance:', error.message);
    }
}

test();
