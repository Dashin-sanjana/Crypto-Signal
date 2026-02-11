const dotenv = require('dotenv');
const path = require('path');
const http = require('http');

// Load env from project root
dotenv.config({ path: path.resolve(__dirname, '.env') });

const TRADING_API_URL = process.env.VITE_TRADING_API_URL || 'http://localhost:3001';

/**
 * Test Telegram Signal Alert
 * 
 * This script sends a test signal to your Telegram bot with full trade setup details.
 * 
 * Usage:
 *   node test-telegram-signal.cjs
 * 
 * Make sure your server is running before executing this script.
 */

function testTelegramSignal() {
    // Test signal configuration - customize these values
    const entryPrice = 45000.50;
    const isBuy = true; // Set to false for SELL signals
    
    const testSignal = {
        symbol: 'BTCUSDT',
        action: isBuy ? 'STRONG BUY' : 'STRONG SELL',
        confidence: 85,
        price: entryPrice,
        reason: 'Manual test signal - testing Telegram integration with full trade setup',
        tpSlData: {
            entry: entryPrice,
            tp1: isBuy ? entryPrice * 1.02 : entryPrice * 0.98,  // 2% take profit
            tp2: isBuy ? entryPrice * 1.05 : entryPrice * 0.95,  // 5% take profit
            sl: isBuy ? entryPrice * 0.98 : entryPrice * 1.02,  // 2% stop loss
            rr: 2.5,        // Risk/Reward ratio
            direction: isBuy ? 'BUY' : 'SELL'
        }
    };

    console.log('\n📤 Sending test signal to Telegram...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Signal Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Symbol:      ${testSignal.symbol}`);
    console.log(`Action:      ${testSignal.action}`);
    console.log(`Confidence:  ${testSignal.confidence}%`);
    console.log(`Price:       $${testSignal.price.toFixed(2)}`);
    console.log('\nTrade Setup:');
    console.log(`  Entry:     $${testSignal.tpSlData.entry.toFixed(2)}`);
    console.log(`  Stop Loss: $${testSignal.tpSlData.sl.toFixed(2)}`);
    console.log(`  TP1:       $${testSignal.tpSlData.tp1.toFixed(2)}`);
    console.log(`  TP2:       $${testSignal.tpSlData.tp2.toFixed(2)}`);
    console.log(`  R:R Ratio: 1:${testSignal.tpSlData.rr}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const url = new URL(`${TRADING_API_URL}/api/telegram/signal`);
    const postData = JSON.stringify(testSignal);
    
    // Debug: Show what we're sending
    console.log('\n📋 Payload being sent:');
    console.log(JSON.stringify(testSignal, null, 2));
    console.log('');

    const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                if (res.statusCode === 200) {
                    console.log('✅ Success! Check your Telegram bot for the message.');
                    console.log('Response:', result);
                    console.log('\n💡 Expected Telegram message format:');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('🟢 Signal Alert');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('Symbol: BTCUSDT');
                    console.log('Action: STRONG BUY');
                    console.log('Direction: LONG');
                    console.log('Confidence: 85%');
                    console.log('Current Price: $45,000.50');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('');
                    console.log('📊 Trade Setup');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('🎯 Entry: $45,000.50');
                    console.log('🛑 Stop Loss: $44,100.49');
                    console.log('   └─ Risk: 2.00%');
                    console.log('');
                    console.log('💰 Take Profit Targets:');
                    console.log('   🎯 TP1: $45,900.51 (+2.00%)');
                    console.log('   🎯 TP2: $47,250.53 (+5.00%)');
                    console.log('');
                    console.log('📈 Risk/Reward: 1:2.50');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('');
                    console.log('📝 Analysis:');
                    console.log('Manual test signal - testing Telegram integration...');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                } else {
                    console.error('❌ Error:', result);
                }
            } catch (error) {
                console.error('❌ Failed to parse response:', error.message);
                console.log('Raw response:', data);
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Failed to send signal:', error.message);
        console.error('\n💡 Troubleshooting:');
        console.error('   1. Make sure your server is running: npm run server');
        console.error(`   2. Check server URL: ${TRADING_API_URL}`);
        console.error('   3. Verify TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
        console.error('   4. Ensure Telegram bot is initialized in server logs\n');
    });

    req.write(postData);
    req.end();
}

// Run the test
testTelegramSignal();
