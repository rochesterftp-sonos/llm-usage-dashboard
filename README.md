# 🤖 LLM Usage Dashboard

Real-time monitoring dashboard for tracking token usage, costs, and billing cycles across multiple LLM providers.

## Features

- **Real-time Usage Tracking**: Monitor tokens and costs for OpenAI, Anthropic, and OpenRouter
- **Billing Cycle Progress**: Visual progress bars showing where you are in each billing cycle
- **Cost Analytics**: Daily averages, projections, and total spend tracking
- **Smart Recommendations**: AI-powered suggestions for cost optimization
- **Historical Trends**: Charts showing usage patterns over time
- **Auto-refresh**: Updates every 5 minutes automatically
- **Manual Refresh**: Click to update instantly

## Quick Start

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/llm-usage-dashboard.git
cd llm-usage-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Add your API keys to `.env`:
```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
```

5. Run the server:
```bash
npm start
```

6. Open http://localhost:3000

### Deploy to Railway

1. Fork this repository on GitHub

2. Create a new project on [Railway](https://railway.app)

3. Connect your GitHub repository

4. Add environment variables in Railway dashboard:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `OPENROUTER_API_KEY`
   - `OPENAI_BILLING_DATE` (day of month, default: 1)
   - `ANTHROPIC_BILLING_DATE` (day of month, default: 1)
   - `OPENROUTER_BILLING_DATE` (day of month, default: 1)

5. Deploy! Railway will automatically detect the start command.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `ANTHROPIC_API_KEY` | Anthropic API key | Required |
| `OPENROUTER_API_KEY` | OpenRouter API key | Required |
| `OPENAI_BILLING_DATE` | Billing cycle day (1-31) | 1 |
| `ANTHROPIC_BILLING_DATE` | Billing cycle day (1-31) | 1 |
| `OPENROUTER_BILLING_DATE` | Billing cycle day (1-31) | 1 |
| `PORT` | Server port | 3000 |

## KPIs Tracked

- **Total Cost (Month)**: Combined spending across all providers
- **Total Tokens**: Cumulative token usage
- **Avg Cost/Day**: Daily spending average
- **Projected Monthly**: Estimated end-of-month cost based on current usage

## Recommendations Engine

The dashboard provides intelligent recommendations for:

- Cost optimization (switch models, reduce usage)
- Billing cycle warnings (approaching limit)
- Usage pattern insights
- Efficiency improvements

## API Endpoints

- `GET /api/usage` - Get current usage data
- `POST /api/refresh` - Force update all data
- `GET /api/recommendations` - Get cost/usage recommendations

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla JS + Chart.js
- **APIs**: OpenAI, Anthropic, OpenRouter
- **Deployment**: Railway
- **Hosting**: GitHub

## License

MIT

## Author

Steve Ventes - Digital CHRO, Level 2 Compliance Solutions (L2CS)
