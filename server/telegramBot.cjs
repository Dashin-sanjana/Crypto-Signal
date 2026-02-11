const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const dotenv = require('dotenv');

// Load env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

class TelegramBotService {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = process.env.TELEGRAM_CHAT_ID;
        this.enableCommands = process.env.TELEGRAM_ENABLE_COMMANDS === 'true'; // Default: false (signals only)
        this.bot = null;
        this.enabled = false;

        if (this.token && this.chatId) {
            try {
                this.bot = new TelegramBot(this.token, { polling: this.enableCommands });
                this.enabled = true;
                const mode = this.enableCommands ? 'with commands' : 'signals only';
                console.log(`Telegram bot initialized (${mode} mode)`);
            } catch (error) {
                console.error('Failed to initialize Telegram bot:', error.message);
                this.enabled = false;
            }
        } else {
            console.warn('Telegram bot not configured: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing');
        }
    }

    /**
     * Send a message to the configured chat
     */
    async sendMessage(text, options = {}) {
        if (!this.enabled || !this.bot) {
            console.log('[Telegram] Would send:', text);
            return false;
        }

        try {
            await this.bot.sendMessage(this.chatId, text, {
                parse_mode: 'HTML',
                ...options
            });
            return true;
        } catch (error) {
            console.error('Telegram send error:', error.message);
            return false;
        }
    }

    /**
     * Format and send a trading signal alert with full trade setup
     */
    async sendSignal(symbol, action, confidence, price, reason, tpSlData = null) {
        const emoji = action.includes('BUY') ? '🟢' : action.includes('SELL') ? '🔴' : '⚪';
        const direction = action.includes('BUY') ? 'LONG' : action.includes('SELL') ? 'SHORT' : 'NEUTRAL';
        
        // Debug logging
        console.log('[Telegram Bot] sendSignal called with tpSlData:', tpSlData ? 'YES' : 'NO');
        if (tpSlData) {
            console.log('[Telegram Bot] tpSlData content:', JSON.stringify(tpSlData, null, 2));
        }
        
        let message = `
${emoji} <b>Signal Alert</b>
━━━━━━━━━━━━━━━━
<b>Symbol:</b> ${symbol}
<b>Action:</b> ${action}
<b>Direction:</b> ${direction}
<b>Confidence:</b> ${confidence}%
<b>Current Price:</b> $${price?.toFixed(4) || 'N/A'}
━━━━━━━━━━━━━━━━
        `.trim();

        // Add trade setup if provided
        if (tpSlData) {
            console.log('[Telegram Bot] Processing tpSlData:', JSON.stringify(tpSlData, null, 2));
            const { entry, tp1, tp2, sl, rr, direction: tradeDir } = tpSlData;
            
            // Always add trade setup section if tpSlData exists
            message += `\n\n<b>📊 Trade Setup</b>\n`;
            message += `━━━━━━━━━━━━━━━━\n`;
            
            // Entry price
            const entryPrice = entry || price;
            message += `🎯 <b>Entry:</b> $${entryPrice?.toFixed(4) || 'N/A'}\n`;
            
            // Stop Loss
            if (sl) {
                message += `🛑 <b>Stop Loss:</b> $${sl.toFixed(4)}\n`;
                if (entryPrice && sl) {
                    const slDistance = Math.abs(((sl - entryPrice) / entryPrice) * 100).toFixed(2);
                    message += `   └─ Risk: ${slDistance}%\n`;
                }
            }
            
            // Take Profit Targets
            if (tp1 || tp2) {
                message += `\n💰 <b>Take Profit Targets:</b>\n`;
                if (tp1) {
                    message += `   🎯 TP1: $${tp1.toFixed(4)}`;
                    if (entryPrice) {
                        const tp1Distance = Math.abs(((tp1 - entryPrice) / entryPrice) * 100).toFixed(2);
                        message += ` (+${tp1Distance}%)`;
                    }
                    message += `\n`;
                }
                if (tp2) {
                    message += `   🎯 TP2: $${tp2.toFixed(4)}`;
                    if (entryPrice) {
                        const tp2Distance = Math.abs(((tp2 - entryPrice) / entryPrice) * 100).toFixed(2);
                        message += ` (+${tp2Distance}%)`;
                    }
                    message += `\n`;
                }
            }
            
            // Risk/Reward
            if (rr) {
                message += `\n📈 <b>Risk/Reward:</b> 1:${rr.toFixed(2)}\n`;
            }
            
            message += `━━━━━━━━━━━━━━━━`;
            
            console.log('[Telegram Bot] Message after adding TP/SL:', message.substring(0, 200) + '...');
        } else {
            console.log('[Telegram Bot] No tpSlData provided, skipping trade setup');
        }

        // Add reason if provided
        if (reason) {
            message += `\n\n<b>📝 Analysis:</b>\n${reason}`;
        }

        return await this.sendMessage(message);
    }

    /**
     * Send trade execution notification
     */
    async sendTradeExecution(symbol, side, quantity, price, orderId) {
        const emoji = side === 'BUY' ? '📈' : '📉';
        const message = `
${emoji} <b>Trade Executed</b>
━━━━━━━━━━━━━━━━
<b>Symbol:</b> ${symbol}
<b>Side:</b> ${side}
<b>Quantity:</b> ${quantity.toFixed(6)}
<b>Price:</b> $${price?.toFixed(4) || 'N/A'}
<b>Order ID:</b> ${orderId}
<b>Time:</b> ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━
        `.trim();

        return await this.sendMessage(message);
    }

    /**
     * Send kill switch activation alert
     */
    async sendKillSwitchAlert() {
        const message = `
⚠️ <b>KILL SWITCH ACTIVATED</b>
━━━━━━━━━━━━━━━━
All trading has been disabled.
All open positions are being closed.
━━━━━━━━━━━━━━━━
        `.trim();

        return await this.sendMessage(message);
    }

    /**
     * Send risk limit warning
     */
    async sendRiskWarning(message) {
        return await this.sendMessage(`⚠️ <b>Risk Warning</b>\n${message}`);
    }

    /**
     * Format status message
     */
    formatStatus(status, openTrades = []) {
        const mode = process.env.BINANCE_TESTNET === 'true' ? '🧪 TESTNET' : '🔴 PRODUCTION';
        const killSwitchStatus = status.killSwitchActive ? '🔴 ACTIVE' : '🟢 INACTIVE';
        const tradingStatus = status.tradingAllowed ? '✅ ENABLED' : '❌ DISABLED';
        
        let message = `
📊 <b>Trading Bot Status</b>
━━━━━━━━━━━━━━━━
<b>Mode:</b> ${mode}
<b>Kill Switch:</b> ${killSwitchStatus}
<b>Trading:</b> ${tradingStatus}
<b>Daily P&L:</b> $${status.dailyPnL.toFixed(2)}
<b>Daily Loss Limit:</b> $${status.dailyLossLimit}
<b>Max Position Size:</b> $${status.maxPositionSize}
<b>Open Trades:</b> ${status.openTradesCount}/${status.maxOpenTrades}
━━━━━━━━━━━━━━━━
        `.trim();

        if (openTrades.length > 0) {
            message += '\n\n<b>Open Positions:</b>\n';
            openTrades.forEach(trade => {
                message += `• ${trade.symbol}: ${trade.side} ${trade.quantity.toFixed(6)} @ $${trade.price?.toFixed(4) || 'N/A'}\n`;
            });
        }

        return message;
    }

    /**
     * Format open trades message
     */
    formatOpenTrades(openTrades) {
        if (openTrades.length === 0) {
            return '📊 <b>Open Trades</b>\n━━━━━━━━━━━━━━━━\nNo open positions.';
        }

        let message = '📊 <b>Open Trades</b>\n━━━━━━━━━━━━━━━━\n';
        openTrades.forEach((trade, index) => {
            message += `${index + 1}. <b>${trade.symbol}</b>\n`;
            message += `   Side: ${trade.side}\n`;
            message += `   Quantity: ${trade.quantity.toFixed(6)}\n`;
            message += `   Entry: $${trade.price?.toFixed(4) || 'N/A'}\n`;
            if (trade.pnl !== undefined) {
                const pnlEmoji = trade.pnl >= 0 ? '🟢' : '🔴';
                message += `   P&L: ${pnlEmoji} $${trade.pnl.toFixed(2)}\n`;
            }
            message += '\n';
        });

        return message.trim();
    }

    /**
     * Setup command handlers (to be called from server/index.cjs)
     * Only sets up commands if TELEGRAM_ENABLE_COMMANDS=true
     */
    setupCommands(riskManager, binanceService) {
        if (!this.enabled || !this.bot || !this.enableCommands) {
            if (!this.enableCommands) {
                console.log('Telegram commands disabled - bot will only send signal notifications');
            }
            return;
        }

        // Start command
        this.bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            const chatIdStr = chatId.toString();
            
            // For groups, check if the chat ID matches (groups have negative IDs)
            // For private chats, check exact match
            const isAuthorized = chatIdStr === this.chatId || 
                                (this.chatId.startsWith('-') && chatIdStr === this.chatId);
            
            if (!isAuthorized) {
                await this.bot.sendMessage(chatId, `❌ Unauthorized access.\n\n🔍 Your Chat ID is: <code>${chatId}</code>\n\nUpdate TELEGRAM_CHAT_ID in your .env file with this number, then restart the server.`, { parse_mode: 'HTML' });
                console.log(`[Telegram] Unauthorized access attempt from chat ID: ${chatId} (expected: ${this.chatId})`);
                return;
            }

            await this.bot.sendMessage(chatId, `
🤖 <b>Crypto Trading Bot</b>
━━━━━━━━━━━━━━━━
Welcome! Use the following commands:

/status - Get bot status
/open_trades - List open positions
/kill_switch - Activate kill switch
/autotrade_on - Enable auto-trading
/autotrade_off - Disable auto-trading
/help - Show this help
━━━━━━━━━━━━━━━━
            `.trim(), { parse_mode: 'HTML' });
        });

        // Status command
        this.bot.onText(/\/status/, async (msg) => {
            const chatId = msg.chat.id;
            const chatIdStr = chatId.toString();
            const isAuthorized = chatIdStr === this.chatId || (this.chatId.startsWith('-') && chatIdStr === this.chatId);
            if (!isAuthorized) {
                await this.bot.sendMessage(chatId, '❌ Unauthorized access.');
                return;
            }

            try {
                const status = riskManager.getStatus();
                const openTrades = riskManager.getOpenTrades();
                const message = this.formatStatus(status, openTrades);
                await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            } catch (error) {
                await this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        });

        // Open trades command
        this.bot.onText(/\/open_trades/, async (msg) => {
            const chatId = msg.chat.id;
            const chatIdStr = chatId.toString();
            const isAuthorized = chatIdStr === this.chatId || (this.chatId.startsWith('-') && chatIdStr === this.chatId);
            if (!isAuthorized) {
                await this.bot.sendMessage(chatId, '❌ Unauthorized access.');
                return;
            }

            try {
                const openTrades = riskManager.getOpenTrades();
                const message = this.formatOpenTrades(openTrades);
                await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            } catch (error) {
                await this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        });

        // Kill switch command
        this.bot.onText(/\/kill_switch/, async (msg) => {
            const chatId = msg.chat.id;
            const chatIdStr = chatId.toString();
            const isAuthorized = chatIdStr === this.chatId || (this.chatId.startsWith('-') && chatIdStr === this.chatId);
            if (!isAuthorized) {
                await this.bot.sendMessage(chatId, '❌ Unauthorized access.');
                return;
            }

            try {
                await binanceService.emergencyCloseAll();
                riskManager.activateKillSwitch();
                await this.sendKillSwitchAlert();
                await this.bot.sendMessage(chatId, '✅ Kill switch activated. All trading disabled.');
            } catch (error) {
                await this.bot.sendMessage(chatId, `❌ Error: ${error.message}`);
            }
        });

        // Auto-trade on command
        this.bot.onText(/\/autotrade_on/, async (msg) => {
            const chatId = msg.chat.id;
            const chatIdStr = chatId.toString();
            const isAuthorized = chatIdStr === this.chatId || (this.chatId.startsWith('-') && chatIdStr === this.chatId);
            if (!isAuthorized) {
                await this.bot.sendMessage(chatId, '❌ Unauthorized access.');
                return;
            }

            // Note: This sets a flag that the frontend should check
            // For now, we'll just send a message
            await this.bot.sendMessage(chatId, '✅ Auto-trading enabled. Note: This must be enabled in the web dashboard.');
        });

        // Auto-trade off command
        this.bot.onText(/\/autotrade_off/, async (msg) => {
            const chatId = msg.chat.id;
            const chatIdStr = chatId.toString();
            const isAuthorized = chatIdStr === this.chatId || (this.chatId.startsWith('-') && chatIdStr === this.chatId);
            if (!isAuthorized) {
                await this.bot.sendMessage(chatId, '❌ Unauthorized access.');
                return;
            }

            await this.bot.sendMessage(chatId, '✅ Auto-trading disabled. Note: This must be disabled in the web dashboard.');
        });

        // Help command
        this.bot.onText(/\/help/, async (msg) => {
            const chatId = msg.chat.id;
            const chatIdStr = chatId.toString();
            const isAuthorized = chatIdStr === this.chatId || (this.chatId.startsWith('-') && chatIdStr === this.chatId);
            if (!isAuthorized) {
                await this.bot.sendMessage(chatId, '❌ Unauthorized access.');
                return;
            }

            await this.bot.sendMessage(chatId, `
🤖 <b>Available Commands</b>
━━━━━━━━━━━━━━━━
/status - Get bot status and risk metrics
/open_trades - List all open positions
/kill_switch - Activate kill switch (closes all positions)
/autotrade_on - Enable auto-trading (informational)
/autotrade_off - Disable auto-trading (informational)
/help - Show this help message
━━━━━━━━━━━━━━━━
            `.trim(), { parse_mode: 'HTML' });
        });

        // Enable polling (only if commands are enabled)
        if (this.enableCommands) {
            this.bot.startPolling();
            console.log('Telegram bot commands registered and polling started');
        }
    }

    /**
     * Check if bot is enabled
     */
    isEnabled() {
        return this.enabled;
    }
}

module.exports = { TelegramBotService };
