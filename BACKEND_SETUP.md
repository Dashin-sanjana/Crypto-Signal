# Crypto-Signal Backend Setup

A lightweight, self-contained backend server for Crypto-Signal that handles trade execution, position management, and real-time updates.

## Features

✅ **Trade Execution** - Execute trades from signals via Binance API  
✅ **Position Management** - Track open positions with real-time P&L  
✅ **SL/TP Monitoring** - Automatic stop-loss and take-profit execution  
✅ **Risk Management** - Max positions, daily loss limits, per-trade risk  
✅ **WebSocket Updates** - Real-time position and trade updates  
✅ **Dry-Run Mode** - Test without real money  

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your Binance API credentials:

```env
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here
BINANCE_TESTNET=true
BINANCE_DRY_RUN=true  # Always start with dry-run!
```

### 3. Run Backend

**Development (with hot reload):**
```bash
npm run server
```

**Production:**
```bash
npm run server:prod
```

**Run both frontend and backend together:**
```bash
npm run dev:full
```

## Server Endpoints

### API (Port 3001)

- `GET /api/status` - Get bot status and positions
- `POST /api/bot/start` - Start bot
- `POST /api/bot/stop` - Stop bot  
- `GET /api/bot/config` - Get bot configuration
- `POST /api/bot/config` - Update bot configuration
- `POST /api/bot/kill` - Emergency kill switch (closes all positions)
- `GET /api/positions` - Get all open positions
- `POST /api/positions/:symbol/close` - Close a specific position
- `POST /api/trades/execute` - Execute a trade from a signal

### WebSocket (Port 3002)

Connect to `ws://localhost:3002` for real-time updates:

- `connected` - Connection established
- `initial_state` - Initial positions and balance
- `positions_update` - Position updates every 5 seconds
- `trade_executed` - Trade execution events
- `position_closed` - Position closure events

## Architecture

```
server/
├── index.ts              # Main server entry point
├── services/
│   ├── BinanceService.ts    # Binance API integration
│   ├── TradeManager.ts      # Trade execution & risk management
│   └── PositionManager.ts   # Position tracking & SL/TP monitoring
└── routes/
    └── index.ts             # API route handlers
```

## Safety Features

1. **Dry-Run Mode** - Default mode simulates trades without real money
2. **Daily Loss Limits** - Stops trading if daily loss exceeds limit
3. **Max Positions** - Limits number of simultaneous positions
4. **Per-Trade Risk** - Limits risk per individual trade
5. **Kill Switch** - Emergency close all positions

## Configuration

Edit `.env` to configure:

- `BINANCE_DRY_RUN` - Enable/disable dry-run mode
- `BINANCE_TESTNET` - Use Binance testnet
- `PORT` - API server port (default: 3001)
- `WS_PORT` - WebSocket port (default: 3002)

## Testing

1. Start with `BINANCE_DRY_RUN=true`
2. Test trade execution from signal cards
3. Monitor positions in real-time
4. Verify SL/TP triggers
5. Only switch to live trading after thorough testing

## Troubleshooting

**Server won't start:**
- Check if ports 3001/3002 are available
- Verify Node.js version (18+)
- Check `.env` file exists

**WebSocket connection fails:**
- Ensure backend is running
- Check `WS_PORT` in `.env` matches frontend config
- Verify CORS settings

**Trades not executing:**
- Check Binance API credentials
- Verify `BINANCE_DRY_RUN` setting
- Check console logs for errors

## Production Deployment

1. Set `BINANCE_DRY_RUN=false` (only after testing!)
2. Use production Binance API keys
3. Set `BINANCE_TESTNET=false`
4. Use process manager (PM2, systemd, etc.)
5. Enable HTTPS for API
6. Use WSS for WebSocket

## Differences from crypto_market_analyzer Backend

This backend is **lightweight and focused**:
- ✅ Only essential trading features
- ✅ No database (in-memory storage)
- ✅ No complex analysis/scanning
- ✅ No strategy performance tracking
- ✅ Simpler, easier to understand
- ✅ Self-contained in Crypto-Signal project

Perfect for Crypto-Signal's needs! 🚀
