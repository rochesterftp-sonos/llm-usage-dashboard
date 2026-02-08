const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// In-memory cache for usage data
let usageData = {
  openai: { tokens: 0, cost: 0, lastUpdated: null, billingCycle: null },
  anthropic: { tokens: 0, cost: 0, lastUpdated: null, billingCycle: null },
  openrouter: { tokens: 0, cost: 0, lastUpdated: null, billingCycle: null },
  history: []
};

// API Keys from environment
const API_KEYS = {
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY
};

// Billing cycle dates from environment
const BILLING_CYCLES = {
  openai: process.env.OPENAI_BILLING_DATE || '1',
  anthropic: process.env.ANTHROPIC_BILLING_DATE || '1',
  openrouter: process.env.OPENROUTER_BILLING_DATE || '1'
};

// Fetch OpenAI usage
async function fetchOpenAIUsage() {
  try {
    if (!API_KEYS.openai) return null;
    
    const response = await axios.get('https://api.openai.com/v1/usage', {
      headers: {
        'Authorization': `Bearer ${API_KEYS.openai}`
      },
      params: {
        date: new Date().toISOString().split('T')[0]
      }
    });
    
    return {
      tokens: response.data.total_usage || 0,
      cost: calculateCost('openai', response.data.total_usage || 0),
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('OpenAI fetch error:', error.message);
    return null;
  }
}

// Fetch Anthropic usage
async function fetchAnthropicUsage() {
  try {
    if (!API_KEYS.anthropic) return null;
    
    // Anthropic doesn't have a direct usage API - we'll estimate from logs
    // For now, return placeholder
    return {
      tokens: 0,
      cost: 0,
      lastUpdated: new Date().toISOString(),
      note: 'Anthropic usage tracking requires session history parsing'
    };
  } catch (error) {
    console.error('Anthropic fetch error:', error.message);
    return null;
  }
}

// Fetch OpenRouter usage
async function fetchOpenRouterUsage() {
  try {
    if (!API_KEYS.openrouter) return null;
    
    const response = await axios.get('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        'Authorization': `Bearer ${API_KEYS.openrouter}`
      }
    });
    
    return {
      tokens: response.data.usage?.total || 0,
      cost: response.data.usage?.cost || 0,
      lastUpdated: new Date().toISOString(),
      limit: response.data.limit,
      remaining: response.data.limit - (response.data.usage?.cost || 0)
    };
  } catch (error) {
    console.error('OpenRouter fetch error:', error.message);
    return null;
  }
}

// Calculate cost (placeholder - update with actual pricing)
function calculateCost(provider, tokens) {
  const pricing = {
    openai: 0.002 / 1000, // $2 per million tokens (example)
    anthropic: 0.003 / 1000,
    openrouter: 0.0015 / 1000
  };
  return tokens * (pricing[provider] || 0);
}

// Calculate billing cycle progress
function getBillingCycleInfo(provider) {
  const cycleDay = parseInt(BILLING_CYCLES[provider]);
  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  let daysElapsed, daysRemaining;
  if (currentDay >= cycleDay) {
    daysElapsed = currentDay - cycleDay;
    daysRemaining = daysInMonth - currentDay + cycleDay;
  } else {
    const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    daysElapsed = prevMonthDays - cycleDay + currentDay;
    daysRemaining = cycleDay - currentDay;
  }
  
  const progress = (daysElapsed / (daysElapsed + daysRemaining)) * 100;
  
  return {
    daysElapsed,
    daysRemaining,
    progress: Math.round(progress),
    resetDate: new Date(now.getFullYear(), now.getMonth() + (currentDay >= cycleDay ? 1 : 0), cycleDay)
  };
}

// Update all usage data
async function updateUsageData() {
  console.log('Updating usage data...');
  
  const [openai, anthropic, openrouter] = await Promise.all([
    fetchOpenAIUsage(),
    fetchAnthropicUsage(),
    fetchOpenRouterUsage()
  ]);
  
  if (openai) {
    usageData.openai = { ...openai, billingCycle: getBillingCycleInfo('openai') };
  }
  if (anthropic) {
    usageData.anthropic = { ...anthropic, billingCycle: getBillingCycleInfo('anthropic') };
  }
  if (openrouter) {
    usageData.openrouter = { ...openrouter, billingCycle: getBillingCycleInfo('openrouter') };
  }
  
  // Add to history
  usageData.history.push({
    timestamp: new Date().toISOString(),
    openai: openai?.tokens || 0,
    anthropic: anthropic?.tokens || 0,
    openrouter: openrouter?.tokens || 0
  });
  
  // Keep last 100 history entries
  if (usageData.history.length > 100) {
    usageData.history = usageData.history.slice(-100);
  }
  
  console.log('Usage data updated');
}

// API Endpoints
app.get('/api/usage', (req, res) => {
  res.json(usageData);
});

app.post('/api/refresh', async (req, res) => {
  await updateUsageData();
  res.json({ success: true, data: usageData });
});

app.get('/api/recommendations', (req, res) => {
  const recommendations = [];
  
  // Cost optimization recommendations
  const totalCost = (usageData.openai.cost || 0) + 
                    (usageData.anthropic.cost || 0) + 
                    (usageData.openrouter.cost || 0);
  
  if (totalCost > 100) {
    recommendations.push({
      type: 'cost',
      severity: 'high',
      message: `Total cost is $${totalCost.toFixed(2)}/month. Consider switching to cheaper models for routine tasks.`
    });
  }
  
  // Billing cycle warnings
  Object.entries(usageData).forEach(([provider, data]) => {
    if (data.billingCycle && data.billingCycle.progress > 80) {
      recommendations.push({
        type: 'billing',
        severity: 'warning',
        message: `${provider}: ${data.billingCycle.progress}% through billing cycle with $${(data.cost || 0).toFixed(2)} spent.`
      });
    }
  });
  
  res.json(recommendations);
});

// Update usage every 5 minutes
cron.schedule('*/5 * * * *', updateUsageData);

// Initial update
updateUsageData();

app.listen(PORT, () => {
  console.log(`LLM Usage Dashboard running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
});
