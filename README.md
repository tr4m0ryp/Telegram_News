# Enhanced Telegram News Aggregation Bot

This service monitors ConsortiumNews, ProPublica, and Truthout for new articles, generates AI summaries, and posts them to a Telegram channel. Now includes enhanced bot commands for monitoring and control.

> 🚀 **New User?** Check out the [Quick Start Guide](QUICK_START.md) for a 5-minute setup!

## 🚀 Features

- **Automated News Monitoring**: Continuously monitors multiple news sources
- **AI-Powered Summaries**: Generates concise summaries using Google's Gemini AI
- **Enhanced Bot Commands**: Full control and monitoring via Telegram commands
- **Comprehensive Logging**: Detailed activity, error, and performance logs
- **Remote Management**: Start, stop, and restart processes remotely

## 🤖 Bot Commands

### Core Commands
- `/log <type>` - Download various log files as .txt documents
- `/status` - Show bot and process status with uptime and memory usage
- `/rerun` - Restart the entire news aggregation process
- `/stop` - Completely shut down the bot and all processes
- `/help` - Show all available commands

### Log Types Available
- `activity` - Full activity log (debug.log)
- `errors` - Error messages (errors.log)
- `articles` - Published articles log (new_articles.log)
- `fetch` - Article fetch monitoring
- `parse` - Article parsing monitoring
- `ai` - AI processing monitoring
- `telegram` - Telegram message delivery monitoring
- `memory` - Memory usage monitoring
- `performance` - Performance metrics

### Usage Examples
```
/log activity          # Download full activity log
/log errors           # Download error log
/log articles         # Download published articles log
/status               # Check system status
/rerun                # Restart if something is stuck
/stop                 # Emergency shutdown
```

## Setup

1. Configure your environment:
```bash
# Required environment variables in .env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID=your_chat_or_channel_id
GOOGLE_API_KEY=your_google_ai_api_key
```

2. Install dependencies:
```bash
npm install
```

3. Start the enhanced bot with news aggregation:
```bash
npm start                 # Full service with bot commands (recommended)
```

Or choose a specific mode:
```bash
npm run bot              # Bot commands only (no automatic news checking)
npm run original         # Original main.js behavior
npm run test            # Test Telegram connectivity
```

## 🔧 Running Modes

### Full Service Mode (Recommended)
```bash
npm start
```
- Starts enhanced bot with all commands
- Runs news aggregation every 30 minutes
- Full monitoring and logging
- Remote control via Telegram commands

### Bot-Only Mode
```bash
npm run bot
```
- Only starts bot for manual control
- Use `/rerun` command to trigger news aggregation
- Perfect for testing or manual operation

### Original Mode
```bash
npm run original
```
- Runs original main.js once and exits
- No bot commands or continuous monitoring

## 📊 Monitoring & Logs

The enhanced system provides comprehensive logging:

### Standard Logs (`logs/` directory)
- `debug.log` - Full activity log
- `errors.log` - Error messages only
- `new_articles.log` - Published articles
- `terminal.log` - General application logs

### Enhanced Monitoring (`logs/monitor/` directory)
- `fetch_monitor.log` - Article fetching attempts
- `parse_monitor.log` - HTML parsing results
- `ai_monitor.log` - AI processing status
- `telegram_monitor.log` - Message delivery status
- `memory_monitor.log` - Memory usage tracking
- `performance_monitor.log` - Performance metrics

### Access Logs via Bot
Use `/log <type>` command to download any log file instantly to your Telegram chat.

## 🔒 Security Notes

- Never commit the `.env` file to version control
- Keep your API keys secret and secure
- Regularly rotate your API keys
- Monitor your API usage to prevent unauthorized access
- Bot commands are restricted to the configured TELEGRAM_CHAT_ID only

## 🛠️ Development

The project uses environment variables for all sensitive configuration. When developing:

1. Always use `config.js` to access environment variables
2. Never hardcode API keys or tokens
3. Use the `.gitignore` file to prevent committing sensitive files
4. Test with `npm run test` before deployment

## 📁 Project Structure

```
├── enhanced_main.js          # Enhanced main script with bot integration
├── bot_controller.js         # Telegram bot command handler
├── bot_launcher.js          # Standalone bot launcher
├── main.js                  # Original main script
├── sender.js                # Telegram message sender
├── ProPublica/              # ProPublica news source
├── consortiumnews/          # ConsortiumNews source
├── utils/                   # Utility modules
│   ├── config.js           # Environment configuration
│   ├── logger.js           # Logging utilities
│   ├── monitoring.js       # Enhanced monitoring
│   └── ...
└── logs/                   # Log files
    └── monitor/            # Enhanced monitoring logs
```

## 🔄 Process Management

The enhanced bot supports full process lifecycle management:

- **Start**: Automatically starts news aggregation
- **Monitor**: Real-time status via `/status` command
- **Restart**: Use `/rerun` to restart stuck processes
- **Stop**: Graceful shutdown with `/stop` command
- **Logs**: Instant access to all logs via `/log` commands

## 🆘 Troubleshooting

### Bot Not Responding
1. Check bot token in `.env` file
2. Verify chat ID is correct
3. Use `/status` to check if process is running
4. Try `/rerun` to restart

### Missing Logs
```bash
/log help              # See available log types
/log activity          # Download main activity log
```

### Process Issues
```bash
/status                # Check process status
/rerun                 # Restart news aggregation
```

### Emergency Stop
```bash
/stop                  # Complete shutdown
```
