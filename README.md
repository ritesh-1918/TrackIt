# TrackIt 📦💰

A Telegram bot for tracking Amazon product prices with automated weekly notifications.

## Features

- 🤖 **Telegram Bot Integration** - Easy-to-use commands for managing tracked products
- 🔍 **Amazon Price Scraping** - Automatically fetches current prices from Amazon
- ⏰ **Scheduled Checks** - Weekly automated price checks with notifications
- 💾 **Local Persistence** - SQLite database for free local storage
- 🎯 **Price Alerts** - Get notified when prices drop below your target

## Tech Stack

- **Runtime**: Node.js (Express)
- **Bot Framework**: node-telegram-bot-api
- **Database**: SQLite (better-sqlite3)
- **Scheduler**: node-cron
- **Scraping**: Axios + Cheerio
- **Configuration**: dotenv

## Project Structure

```
trackit/
├── src/
│   ├── bot/           # Telegram bot logic and commands
│   ├── scraper/       # Amazon price scraping logic
│   ├── scheduler/     # Cron jobs for scheduled checks
│   ├── services/      # Business logic (tracking, limits, subscriptions)
│   ├── db/            # SQLite setup and queries
│   └── utils/         # Helpers and validators
├── index.js           # Application entry point
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- A Telegram Bot Token (get one from [@BotFather](https://t.me/BotFather))

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd trackit
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Telegram Bot Token
   ```

4. Start the application:
   ```bash
   # Development mode (with hot reload)
   npm run dev

   # Production mode
   npm start
   ```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize the bot and register user |
| `/track <url>` | Start tracking an Amazon product |
| `/setprice <id> <price>` | Set target price for a tracked product |
| `/status` | View all your tracked products and their prices |

## Database Schema

### Users Table
- `id` - Primary key
- `telegram_id` - Unique Telegram user ID
- `username` - Telegram username
- `created_at` - Registration timestamp

### Tracked Products Table
- `id` - Primary key
- `user_id` - Foreign key to users
- `amazon_url` - Product URL
- `title` - Product title
- `current_price` - Last fetched price
- `target_price` - User's desired price
- `created_at` - Tracking start timestamp
- `updated_at` - Last price check timestamp

### Subscriptions Table
- `id` - Primary key
- `user_id` - Foreign key to users
- `plan_type` - Subscription tier
- `max_products` - Product tracking limit
- `expires_at` - Subscription expiry

## Configuration

See `.env.example` for all available configuration options.

## Development

```bash
# Run in development mode with nodemon
npm run dev

# Run tests (TODO)
npm test
```

## License

MIT

## TODO

- [ ] Implement full scraping logic with anti-detection measures
- [ ] Add error handling and retry mechanisms
- [ ] Implement subscription tiers
- [ ] Add price history charts
- [ ] Deploy to cloud platform
