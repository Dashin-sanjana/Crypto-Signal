# Telegram Bot Integration Setup

The Telegram bot integration allows you to receive trading signals and control your bot via Telegram commands.

## Setup Instructions

### 1. Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Follow the prompts to name your bot
4. Copy the **bot token** (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Get Your Chat ID

1. Start a conversation with your bot (search for your bot's username)
2. Send any message to your bot (e.g., "Hello")
3. Visit this URL in your browser (replace `YOUR_BOT_TOKEN` with your actual token):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
4. Look for the `"chat":{"id":123456789}` field in the JSON response
5. Copy the **chat ID** (the number)

### 3. Configure Environment Variables

Add the following to your `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

Optional:

- `TELEGRAM_ENABLE_COMMANDS=true` – enable `/status`, `/kill_switch`, etc. (only one server process may run; see Troubleshooting).
- `TELEGRAM_SIGNAL_COOLDOWN_MS=300000` – min time (ms) between sending the same symbol+action signal (default: 300000 = 5 min).
- `TELEGRAM_MIN_INTERVAL_MS=2000` – min time (ms) between any two messages (default: 2000; reduces rate-limit errors).

### 4. Restart the Server

Restart your Node.js server for the changes to take effect:

```bash
npm run server
```

## Available Commands

Once configured, you can use these commands in Telegram:

- `/start` - Show welcome message and available commands
- `/status` - Get bot status (P&L, risk limits, open trades count)
- `/open_trades` - List all open positions
- `/kill_switch` - Activate kill switch (closes all positions and disables trading)
- `/autotrade_on` - Informational command (enable via web dashboard)
- `/autotrade_off` - Informational command (disable via web dashboard)
- `/help` - Show help message

## Automatic Notifications

The bot will automatically send notifications for:

- **Trade Executions**: When a trade is placed (BUY/SELL orders)
- **Signal Alerts**: When strong trading signals are detected (before auto-trade executes)
- **Kill Switch**: When the kill switch is activated
- **Risk Warnings**: When risk limits are approached or exceeded

## Security Notes

- Only messages from the configured `TELEGRAM_CHAT_ID` will be processed
- Unauthorized users will receive an "Unauthorized access" message
- Keep your bot token secret - never commit it to version control
- The `.env` file is already in `.gitignore` for security

## Signal limits

- **Per signal type**: The same symbol+action (e.g. `BTCUSDT:BUY`) is only sent once per cooldown (default 5 min). Configure with `TELEGRAM_SIGNAL_COOLDOWN_MS`.
- **Send rate**: Messages are queued and sent with a minimum interval (default 2 s) to avoid Telegram rate limits. Configure with `TELEGRAM_MIN_INTERVAL_MS`.
- **Queue**: Up to 15 messages are queued; older ones are dropped if the queue is full.

## Troubleshooting

**409 Conflict: "terminated by other getUpdates request"**
- Telegram allows only **one** active polling connection per bot token. This error means more than one server process is running (e.g. two terminals with `npm run server`, or `npm run start` plus a separate server).
- **Fix**: Run only one server process. Stop any duplicate (second terminal, PM2 worker, or dev script that also starts the server). If you use `TELEGRAM_ENABLE_COMMANDS=true`, keep commands in a single process; the app will still send signals/trades from that process.
- On shutdown, the server stops polling so a restart can take over without 409.

**Bot not responding?**
- Check that `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set correctly in `.env`
- Verify the server logs for initialization messages
- Ensure your bot token is valid (test by visiting the getUpdates URL)

**Commands not working?**
- Set `TELEGRAM_ENABLE_COMMANDS=true` and restart. Ensure only one server instance is running (see 409 above).
- Make sure you're messaging from the chat ID configured in `.env`
- Check server logs for error messages

**Not receiving notifications?**
- Verify the bot is enabled (check server logs for "Telegram bot initialized")
- Ensure trades are actually executing (check web dashboard)
- Check server logs for Telegram send errors
