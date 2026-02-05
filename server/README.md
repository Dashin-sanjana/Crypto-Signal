# Crypto-Signal Backend Server

Lightweight trading backend for Crypto-Signal frontend.

## Features

- Trade execution via Binance API
- Position management with SL/TP monitoring
- Real-time WebSocket updates
- Risk management (max positions, daily loss limits)
- Dry-run mode for testing

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Add your Binance API credentials to `.env`:
```
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret
BINANCE_DRY_RUN=true  # Set to false for live trading
```

## Running

### Development (with hot reload):
```bash
npm run server
```

### Production:
```bash
npm run server:prod
```

### Run both frontend and backend:
```bash
npm run dev:full
```

## API Endpoints

- `GET /api/status` - Bot status and positions
- `POST /api/bot/start` - Start bot
- `POST /api/bot/stop` - Stop bot
- `POST /api/bot/config` - Update configuration
- `GET /api/positions` - Get open positions
- `POST /api/positions/:symbol/close` - Close position
- `POST /api/trades/execute` - Execute trade from signal

## WebSocket

Connect to `ws://localhost:3002` for real-time updates:
- `positions_update` - Position updates every 5 seconds
- `trade_executed` - Trade execution events
- `position_closed` - Position closure events

## Safety

- **Always use DRY_RUN=true for testing**
- Start with small position sizes
- Set appropriate daily loss limits
- Monitor positions regularly
