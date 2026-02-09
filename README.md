# LLM Usage Dashboard

Real-time monitoring dashboard for LLM API usage across OpenAI, Anthropic, and OpenRouter.

## Features

- 🔐 **Password-protected access** - Secure authentication required
- 📊 **Real-time usage tracking** - Tokens and costs across 3 providers
- 📅 **Billing cycle progress** - Visual progress bars with days remaining
- 💡 **Smart recommendations** - Cost optimization and usage alerts
- 📱 **Mobile-responsive** - Works great on phones and tablets
- 🛡️ **Security page** - Transparent threat model and protections
- 🔄 **Auto-refresh** - Updates every 5 minutes automatically

## Security

- **API keys stay server-side** - Never exposed to browser
- **Session-based auth** - 24-hour sessions with secure cookies
- **HTTPS encryption** - All traffic encrypted via TLS (Railway auto-provisions SSL)
- **No PII storage** - Only aggregated metrics tracked
- **Comprehensive security documentation** - See `/security.html` in the app

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

   Required variables:
   - `DASHBOARD_PASSWORD` - Password for accessing the dashboard
   - `SESSION_SECRET` - Random string for session encryption
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `ANTHROPIC_API_KEY` - Your Anthropic API key
   - `OPENROUTER_API_KEY` - Your OpenRouter API key
   - `OPENAI_BILLING_DATE` - Day of month billing cycle starts (1-31)
   - `ANTHROPIC_BILLING_DATE` - Day of month billing cycle starts (1-31)
   - `OPENROUTER_BILLING_DATE` - Day of month billing cycle starts (1-31)

3. **Run the server:**
   ```bash
   node server.js
   ```

4. **Access the dashboard:**
   Open http://localhost:3000 and log in with your password

## Railway Deployment

1. **Create a new Railway project:**
   - Connect your GitHub repo
   - Railway will auto-detect Node.js

2. **Set environment variables in Railway dashboard:**
   - All variables from `.env.example`
   - **Important:** Use a strong password for `DASHBOARD_PASSWORD`
   - **Important:** Generate a random secret for `SESSION_SECRET`

3. **Deploy:**
   - Railway will automatically build and deploy
   - SSL certificate provisioned automatically
   - Access via the generated Railway URL

## Project Structure

```
llm-usage-dashboard/
├── server.js           # Express backend with API endpoints
├── public/
│   ├── index.html      # Main dashboard UI
│   ├── security.html   # Security documentation
│   ├── styles.css      # Mobile-responsive styles
│   └── app.js          # Frontend JavaScript
├── package.json
├── .env.example        # Example environment config
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/login` - Login with password
- `POST /api/logout` - End session
- `GET /api/auth-status` - Check if authenticated

### Data (Protected)
- `GET /api/usage` - Get current usage data
- `POST /api/refresh` - Force refresh from providers
- `GET /api/recommendations` - Get optimization recommendations

## Technology Stack

- **Backend:** Node.js, Express
- **Session:** express-session
- **HTTP Client:** axios
- **Scheduler:** node-cron
- **Frontend:** Vanilla JavaScript (no framework)
- **Styling:** Custom CSS with mobile-first design

## Best Practices

1. **Use a strong password** - Minimum 16 characters
2. **Don't share the URL** - Keep the dashboard link private
3. **Monitor usage regularly** - Check for unexpected spikes
4. **Rotate API keys** - Every quarter recommended
5. **Log out when done** - Especially on shared devices
6. **Enable 2FA** - On all provider accounts

## Incident Response

If you suspect a security breach:

1. Change `DASHBOARD_PASSWORD` in Railway env vars immediately
2. Rotate all affected API keys (OpenAI, Anthropic, OpenRouter)
3. Review Railway access logs for unusual activity
4. Check provider dashboards for unexpected usage
5. Document the incident and timeline

## License

Proprietary - Level 2 Compliance Solutions

## Support

Internal use only. For questions, contact David Chambers.
