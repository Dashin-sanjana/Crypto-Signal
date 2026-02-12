const path = require('path');
const fs = require('fs');

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'data', 'trading.db');

let db = null;
let SQL = null;

function ensureDir() {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function saveToFile() {
    if (!db) return;
    ensureDir();
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
}

function initSchema() {
    db.run(`
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            side TEXT NOT NULL,
            quantity REAL NOT NULL,
            price REAL NOT NULL,
            order_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            source TEXT NOT NULL DEFAULT 'single',
            closed_at INTEGER
        )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_trades_closed ON trades(closed_at)`);

    db.run(`
        CREATE TABLE IF NOT EXISTS signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            action TEXT NOT NULL,
            confidence INTEGER NOT NULL,
            price REAL,
            timestamp INTEGER NOT NULL,
            sent_to_telegram INTEGER NOT NULL DEFAULT 0
        )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_signals_symbol_ts ON signals(symbol, timestamp)`);

    db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `);
}

async function init() {
    if (db) return;
    const mod = require('sql.js');
    const initSqlJs = typeof mod === 'function' ? mod : (mod.default || mod.initSqlJs || mod);
    SQL = await initSqlJs();
    ensureDir();
    if (fs.existsSync(dbPath)) {
        const buf = fs.readFileSync(dbPath);
        db = new SQL.Database(buf);
    } else {
        db = new SQL.Database();
    }
    initSchema();
    saveToFile();
}

function getDb() {
    if (!db) throw new Error('Database not initialized. Call await db.init() first.');
    return db;
}

function getOpenTradesFromDb() {
    const d = getDb();
    const result = d.exec(
        'SELECT symbol, side, quantity, price, order_id, timestamp FROM trades WHERE closed_at IS NULL ORDER BY timestamp DESC'
    );
    if (!result.length || !result[0].values.length) return [];
    const cols = result[0].columns;
    const idx = { symbol: cols.indexOf('symbol'), side: cols.indexOf('side'), quantity: cols.indexOf('quantity'), price: cols.indexOf('price'), order_id: cols.indexOf('order_id'), timestamp: cols.indexOf('timestamp') };
    return result[0].values.map(row => ({
        symbol: row[idx.symbol],
        side: row[idx.side],
        quantity: row[idx.quantity],
        price: row[idx.price],
        orderId: row[idx.order_id],
        timestamp: row[idx.timestamp]
    }));
}

function recordTradeInDb(trade) {
    const d = getDb();
    d.run(
        'INSERT INTO trades (symbol, side, quantity, price, order_id, timestamp, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
            trade.symbol,
            trade.side,
            trade.quantity,
            trade.price,
            trade.orderId,
            trade.timestamp ?? Date.now(),
            trade.source || 'single'
        ]
    );
    saveToFile();
}

function closeTradeInDb(symbol) {
    getDb().run(
        'UPDATE trades SET closed_at = ? WHERE symbol = ? AND closed_at IS NULL',
        [Date.now(), symbol]
    );
    saveToFile();
}

function closeAllTradesInDb() {
    getDb().run('UPDATE trades SET closed_at = ? WHERE closed_at IS NULL', [Date.now()]);
    saveToFile();
}

function hasOpenTradeInDb(symbol) {
    const d = getDb();
    const stmt = d.prepare('SELECT 1 FROM trades WHERE symbol = ? AND closed_at IS NULL LIMIT 1');
    stmt.bind([symbol]);
    const has = stmt.step();
    stmt.free();
    return !!has;
}

function getLastOrderAttemptInDb(symbol, withinMs) {
    const since = Date.now() - withinMs;
    const d = getDb();
    const stmt = d.prepare(
        'SELECT timestamp FROM trades WHERE symbol = ? AND timestamp >= ? ORDER BY timestamp DESC LIMIT 1'
    );
    stmt.bind([symbol, since]);
    const has = stmt.step();
    const row = has ? stmt.getAsObject() : null;
    stmt.free();
    return row ? row.timestamp : null;
}

function recordSignal(symbol, action, confidence, price, sentToTelegram) {
    getDb().run(
        'INSERT INTO signals (symbol, action, confidence, price, timestamp, sent_to_telegram) VALUES (?, ?, ?, ?, ?, ?)',
        [symbol, action, confidence, price ?? null, Date.now(), sentToTelegram ? 1 : 0]
    );
    saveToFile();
}

function getLastSignalForSymbol(symbol, withinMs) {
    const since = Date.now() - withinMs;
    const d = getDb();
    const stmt = d.prepare(
        'SELECT action, timestamp FROM signals WHERE symbol = ? AND timestamp >= ? ORDER BY timestamp DESC LIMIT 1'
    );
    stmt.bind([symbol, since]);
    const has = stmt.step();
    const row = has ? stmt.getAsObject() : null;
    stmt.free();
    return row;
}

function getSettings() {
    const result = getDb().exec('SELECT key, value FROM settings');
    const out = {};
    if (result.length && result[0].values.length) {
        const cols = result[0].columns;
        const ki = cols.indexOf('key');
        const vi = cols.indexOf('value');
        result[0].values.forEach(row => {
            try {
                out[row[ki]] = JSON.parse(row[vi]);
            } catch {
                out[row[ki]] = row[vi];
            }
        });
    }
    return out;
}

function setSetting(key, value) {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    getDb().run(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, valueStr]
    );
    saveToFile();
}

module.exports = {
    init,
    getDb,
    initSchema,
    getOpenTradesFromDb,
    recordTradeInDb,
    closeTradeInDb,
    closeAllTradesInDb,
    hasOpenTradeInDb,
    getLastOrderAttemptInDb,
    recordSignal,
    getLastSignalForSymbol,
    getSettings,
    setSetting
};
