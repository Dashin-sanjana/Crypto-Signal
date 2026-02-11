# Telegram Group Setup - Signals Only Mode

This guide shows you how to configure the bot to send signals **only** (no commands) to a Telegram group.

## Step 1: Add Bot to Your Group

1. Open your Telegram group
2. Click on group name → **Add Members**
3. Search for your bot's username (the one you created with @BotFather)
4. Add the bot to the group

## Step 2: Get Your Group Chat ID

Group chat IDs are **negative numbers**. Here's how to get it:

### Method 1: Using getUpdates API

1. Make sure your bot is in the group
2. Send any message in the group (or have someone else send one)
3. Visit this URL in your browser (replace `YOUR_BOT_TOKEN`):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
4. Look for `"chat":{"id":-1001234567890}` - the **negative number** is your group chat ID
5. Copy that number (including the minus sign)

### Method 2: Using @userinfobot

1. Add `@userinfobot` to your group
2. It will show the group ID in the chat
3. Remove `@userinfobot` after getting the ID

### Method 3: Using @RawDataBot

1. Add `@RawDataBot` to your group
2. It will show detailed group information including the chat ID
3. Remove `@RawDataBot` after getting the ID

## Step 3: Configure Your Bot

Update your `.env` file:

```env
# Your bot token (same as before)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Your GROUP chat ID (negative number, e.g., -1001234567890)
TELEGRAM_CHAT_ID=-1001234567890

# Set to false for signals only (no commands)
TELEGRAM_ENABLE_COMMANDS=false
```

**Important Notes:**
- Group chat IDs start with `-100` (e.g., `-1001234567890`)
- Make sure to include the minus sign
- Set `TELEGRAM_ENABLE_COMMANDS=false` to disable all commands

## Step 4: Give Bot Permissions (Optional)

For the bot to work properly in groups, it's recommended to:

1. Go to group settings → **Administrators**
2. Add your bot as an administrator (optional, but recommended)
3. Give it permission to **Post Messages** (if you want it to send messages without restrictions)

**Note:** Even without admin rights, the bot can send messages if it's a member of the group.

## Step 5: Restart Your Server

```bash
npm run server
```

## Step 6: Test It

Run the test script:

```bash
node test-telegram-signal.cjs
```

You should see the signal message appear in your Telegram group!

## What the Bot Will Do

✅ **Will Send:**
- Signal alerts with full trade setup (Entry, TP1, TP2, Stop Loss, R:R)
- Trade execution notifications
- Kill switch alerts (if enabled)

❌ **Won't Respond To:**
- `/start`, `/status`, `/open_trades`, `/kill_switch` commands
- Any commands (since `TELEGRAM_ENABLE_COMMANDS=false`)

## Troubleshooting

**Bot not sending messages to group?**
- Verify the group chat ID is correct (must be negative)
- Make sure the bot is added to the group
- Check server logs for errors
- Ensure `TELEGRAM_CHAT_ID` matches your group ID exactly

**Want to enable commands later?**
- Set `TELEGRAM_ENABLE_COMMANDS=true` in `.env`
- Restart the server
- Commands will work in the group (but only from authorized chat ID)

**Bot sending to wrong chat?**
- Double-check `TELEGRAM_CHAT_ID` in `.env`
- Make sure you're using the group ID, not your personal chat ID
- Restart the server after changing `.env`

## Security Note

Even with commands disabled, the bot will only send signals to the chat ID specified in `TELEGRAM_CHAT_ID`. This means:
- Signals go to your configured group
- No unauthorized access to commands
- Clean, signal-only notifications
