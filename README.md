# News Aggregation Service

This service monitors ConsortiumNews, ProPublica, and Truthout for new articles, generates AI summaries, and posts them to a Telegram channel.

## Setup

1. Copy the environment template:
```bash
cp .env.template .env
```

2. Edit the `.env` file and add your credentials:
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token from @BotFather
- `TELEGRAM_CHAT_ID`: The ID of your Telegram channel/group
- `GOOGLE_API_KEY`: Your Google AI API key

3. Install dependencies:
```bash
npm install
```

4. Start the service:
```bash
node main.js
```

## Security Notes

- Never commit the `.env` file to version control
- Keep your API keys secret and secure
- Regularly rotate your API keys
- Monitor your API usage to prevent unauthorized access

## Development

The project uses environment variables for all sensitive configuration. When developing:

1. Always use `config.js` to access environment variables
2. Never hardcode API keys or tokens
3. Use the `.gitignore` file to prevent committing sensitive files

## Logging

Logs are stored in the `logs/` directory:
- `terminal.log`: General application logs
- `errors.log`: Error messages
- `new_articles.log`: New articles found
