/**
 * Lightweight trading backend for Crypto-Signal
 * Provides trade execution, position management, and real-time updates
 */
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { TradeManager, setBroadcastFunction as setTradeBroadcast } from './services/TradeManager';
import { BinanceService } from './services/BinanceService';
import { PositionManager, setBroadcastFunction as setPositionBroadcast } from './services/PositionManager';
import { routes } from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const binanceService = new BinanceService({
  apiKey: process.env.BINANCE_API_KEY || '',
  apiSecret: process.env.BINANCE_API_SECRET || '',
  testnet: process.env.BINANCE_TESTNET === 'true',
  dryRun: process.env.BINANCE_DRY_RUN === 'true',
});

const positionManager = new PositionManager(binanceService);
const tradeManager = new TradeManager(binanceService, positionManager);

// Routes
app.use('/api', routes(tradeManager, positionManager, binanceService));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ port: Number(WS_PORT) });

// Broadcast function for trade events
const broadcastToClients = (message: any) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
};

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  // Send initial state
  ws.send(JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString(),
  }));

  // Send initial positions
  const positions = positionManager.getPositions();
  ws.send(JSON.stringify({
    type: 'initial_state',
    positions: positions,
    positions_count: positions.length,
    balance: binanceService.getBalance(),
    timestamp: new Date().toISOString(),
  }));

  // Broadcast position updates every 5 seconds
  const positionInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      const positions = positionManager.getPositions();
      ws.send(JSON.stringify({
        type: 'positions_update',
        positions: positions,
        positions_count: positions.length,
        balance: binanceService.getBalance(),
        timestamp: new Date().toISOString(),
      }));
    }
  }, 5000);

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clearInterval(positionInterval);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Export broadcast function for use in services
export { broadcastToClients };

// Inject broadcast function into services (after wss is created)
setTradeBroadcast(broadcastToClients);
setPositionBroadcast(broadcastToClients);

// Start position monitoring
positionManager.startMonitoring();

// Start servers
server.listen(PORT, () => {
  console.log(`🚀 Trading API server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server running on ws://localhost:${WS_PORT}`);
  console.log(`🔧 Mode: ${process.env.BINANCE_DRY_RUN === 'true' ? 'DRY RUN' : 'LIVE'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  positionManager.stopMonitoring();
  wss.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
