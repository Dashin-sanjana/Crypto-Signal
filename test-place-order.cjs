/**
 * Manual test: place a single order on Binance Futures (same BinanceFuturesService as the app).
 * Uses .env: BINANCE_API_KEY, BINANCE_API_SECRET, BINANCE_FAPI_BASE_URL, BINANCE_TESTNET, BINANCE_DRY_RUN.
 *
 * Usage:
 *   node test-place-order.cjs                    # symbol BTCUSDT BUY, min valid qty
 *   node test-place-order.cjs BTCUSDT BUY       # explicit symbol + side
 *   node test-place-order.cjs ETHUSDT SELL 0.1  # symbol, side, quantity
 *   node test-place-order.cjs --live            # force real order (overrides BINANCE_DRY_RUN for this run)
 */
const path = require('path');
const dotenv = require('dotenv');
const { BinanceFuturesService } = require('./server/binanceFuturesService.cjs');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const args = process.argv.slice(2);
const forceLive = args.includes('--live');
const rest = args.filter((a) => a !== '--live');
const symbol = rest[0] || 'BTCUSDT';
const side = (rest[1] || 'BUY').toUpperCase();
const quantityArg = rest[2]; // optional number

if (side !== 'BUY' && side !== 'SELL') {
  console.error('Side must be BUY or SELL');
  process.exit(1);
}

async function main() {
  if (forceLive) {
    process.env.BINANCE_DRY_RUN = 'false';
  }
  const binance = new BinanceFuturesService();

  console.log('--- Futures Demo test: place order ---');
  console.log('Base URL:', binance.baseUrl);
  console.log('Symbol:', symbol, '| Side:', side, '| Quantity:', quantityArg ?? '(min from exchange)');
  console.log('Testnet flag:', binance.isTestnet(), '| Dry run:', binance.isDryRun());
  console.log('');

  try {
    // 1) Test account endpoint first so you see key/permission issues clearly
    console.log('Checking /account permissions...');
    const account = await binance.getAccountInfo();
    console.log('Account OK. Total positions:', (account.positions || []).length);
    console.log('');

    // 2) Fetch current price
    const price = await binance.getCurrentPrice(symbol);
    console.log('Current price', symbol, ':', price);

    // 3) Compute quantity if not provided: respect LOT_SIZE + MIN_NOTIONAL/NOTIONAL
    let quantity = quantityArg ? parseFloat(quantityArg) : null;
    if (quantity == null || quantity <= 0) {
      const info = await binance.getExchangeInfo();
      const sym = info.symbols?.find((s) => s.symbol === symbol);
      if (!sym) {
        console.error('Symbol not found in exchangeInfo:', symbol);
        process.exit(1);
      }
      const lot = sym.filters?.find((f) => f.filterType === 'LOT_SIZE');
      const notional = sym.filters?.find(
        (f) => f.filterType === 'MIN_NOTIONAL' || f.filterType === 'NOTIONAL'
      );
      const minQty = lot ? parseFloat(lot.minQty) : 0.0001;
      const stepSize = lot ? parseFloat(lot.stepSize) : 0.0001;
      const minNotionalUsdt =
        notional && notional.minNotional ? parseFloat(notional.minNotional) : 5;
      const qtyFromNotional = minNotionalUsdt / price;
      quantity = Math.max(minQty, qtyFromNotional);
      const precision =
        stepSize < 1 ? (String(stepSize).split('.')[1]?.length || 8) : 0;
      const steps = Math.ceil(quantity / stepSize);
      quantity = parseFloat((steps * stepSize).toFixed(precision));
      console.log(
        'Using quantity:',
        quantity,
        '(min notional ~' + minNotionalUsdt + ' USDT, stepSize:',
        lot?.stepSize + ')'
      );
    }

    // 4) Place futures order
    const order = await binance.placeOrder({
      symbol,
      side, // BUY = long, SELL = short (one-way mode)
      type: 'MARKET',
      quantity
    });

    console.log('');
    console.log('Order result:', JSON.stringify(order, null, 2));
    if (order.orderId) {
      console.log('Order ID:', order.orderId);
      if (order.fills && order.fills.length) {
        console.log(
          'Fills:',
          order.fills.map((f) => ({ price: f.price, qty: f.qty }))
        );
      }
    }
    if (binance.isDryRun() && order.orderId && String(order.orderId).startsWith('Simulated-')) {
      console.log('SUCCESS: Dry run – order was simulated only.');
    } else if (!binance.isDryRun()) {
      console.log('SUCCESS: Real futures order placed on Binance (demo/testnet).');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();