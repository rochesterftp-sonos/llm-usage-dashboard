const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const session = require('express-session');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Settings file path
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// Encryption key (from env or generate)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

// In-memory settings cache
let settings = {
  dashboardPassword: process.env.DASHBOARD_PASSWORD || 'changeme',
  openaiKey: process.env.OPENAI_API_KEY || '',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  openrouterKey: process.env.OPENROUTER_API_KEY || '',
  openaiCycle: process.env.OPENAI_BILLING_DATE || '1',
  anthropicCycle: process.env.ANTHROPIC_BILLING_DATE || '1',
  openrouterCycle: process.env.OPENROUTER_BILLING_DATE || '1'
};

// Encrypt data
function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Decrypt data
function decrypt(text) {
  if (!text) return '';
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error.message);
    return '';
  }
}

// Load settings from file
async function loadSettings() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    const encrypted = JSON.parse(data);
    
    // Decrypt sensitive fields
    settings = {
      dashboardPassword: encrypted.dashboardPassword ? decrypt(encrypted.dashboardPassword) : settings.dashboardPassword,
      openaiKey: encrypted.openaiKey ? decrypt(encrypted.openaiKey) : settings.openaiKey,
      anthropicKey: encrypted.anthropicKey ? decrypt(encrypted.anthropicKey) : settings.anthropicKey,
      openrouterKey: encrypted.openrouterKey ? decrypt(encrypted.openrouterKey) : settings.openrouterKey,
      openaiCycle: encrypted.openaiCycle || settings.openaiCycle,
      anthropicCycle: encrypted.anthropicCycle || settings.anthropicCycle,
      openrouterCycle: encrypted.openrouterCycle || settings.openrouterCycle
    };
    
    console.log('Settings loaded from file');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error loading settings:', error.message);
    }
    // Use defaults from env vars if file doesn't exist
  }
}

// Save settings to file
async function saveSettings() {
  try {
    const encrypted = {
      dashboardPassword: settings.dashboardPassword ? encrypt(settings.dashboardPassword) : '',
      openaiKey: settings.openaiKey ? encrypt(settings.openaiKey) : '',
      anthropicKey: settings.anthropicKey ? encrypt(settings.anthropicKey) : '',
      openrouterKey: settings.openrouterKey ? encrypt(settings.openrouterKey) : '',
      openaiCycle: settings.openaiCycle,
      anthropicCycle: settings.anthropicCycle,
      openrouterCycle: settings.openrouterCycle
    };
    
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(encrypted, null, 2));
    console.log('Settings saved to file');
  } catch (error) {
    console.error('Error saving settings:', error.message);
    throw error;
  }
}

// Trust Railway proxy for secure cookies
app.set('trust proxy', 1);

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'llm-dashboard-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// Serve static files
app.use(express.static('static'));
app.use(express.json());

// Health check (for debugging)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'running', env: process.env.NODE_ENV });
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// In-memory cache for usage data
let usageData = {
  openai: { tokens: 0, cost: 0, lastUpdated: null, billingCycle: null },
  anthropic: { tokens: 0, cost: 0, lastUpdated: null, billingCycle: null },
  openrouter: { tokens: 0, cost: 0, lastUpdated: null, billingCycle: null },
  history: []
};

// Fetch OpenAI usage
async function fetchOpenAIUsage() {
  try {
    if (!settings.openaiKey) return null;
    
    const response = await axios.get('https://api.openai.com/v1/usage', {
      headers: {
        'Authorization': `Bearer ${settings.openaiKey}`
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
    if (!settings.anthropicKey) return null;
    
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
    if (!settings.openrouterKey) return null;
    
    const response = await axios.get('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        'Authorization': `Bearer ${settings.openrouterKey}`
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
  const cycleDay = parseInt(settings[provider + 'Cycle']);
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

// Authentication endpoints
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  
  if (password === settings.dashboardPassword) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth-status', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

// Settings endpoints
app.get('/api/settings', requireAuth, (req, res) => {
  // Return settings without exposing full API keys
  res.json({
    dashboardPassword: settings.dashboardPassword ? '••••••••' : '',
    openaiKey: settings.openaiKey ? 'sk-...••••' : '',
    anthropicKey: settings.anthropicKey ? 'sk-ant-...••••' : '',
    openrouterKey: settings.openrouterKey ? 'sk-or-...••••' : '',
    openaiCycle: settings.openaiCycle,
    anthropicCycle: settings.anthropicCycle,
    openrouterCycle: settings.openrouterCycle
  });
});

app.post('/api/settings', requireAuth, async (req, res) => {
  try {
    const updates = req.body;
    
    // Update only provided fields
    if (updates.dashboardPassword) settings.dashboardPassword = updates.dashboardPassword;
    if (updates.openaiKey) settings.openaiKey = updates.openaiKey;
    if (updates.anthropicKey) settings.anthropicKey = updates.anthropicKey;
    if (updates.openrouterKey) settings.openrouterKey = updates.openrouterKey;
    if (updates.openaiCycle) settings.openaiCycle = updates.openaiCycle;
    if (updates.anthropicCycle) settings.anthropicCycle = updates.anthropicCycle;
    if (updates.openrouterCycle) settings.openrouterCycle = updates.openrouterCycle;
    
    await saveSettings();
    
    // Refresh usage data with new API keys
    await updateUsageData();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Settings save error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Test API connections
app.post('/api/test-connections', requireAuth, async (req, res) => {
  const results = {
    openai: false,
    anthropic: false,
    openrouter: false
  };
  
  // Test OpenAI
  if (settings.openaiKey) {
    try {
      await axios.get('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${settings.openaiKey}` }
      });
      results.openai = true;
    } catch (error) {
      console.error('OpenAI test failed:', error.message);
    }
  }
  
  // Test Anthropic
  if (settings.anthropicKey) {
    try {
      await axios.get('https://api.anthropic.com/v1/models', {
        headers: { 
          'x-api-key': settings.anthropicKey,
          'anthropic-version': '2023-06-01'
        }
      });
      results.anthropic = true;
    } catch (error) {
      console.error('Anthropic test failed:', error.message);
    }
  }
  
  // Test OpenRouter
  if (settings.openrouterKey) {
    try {
      await axios.get('https://openrouter.ai/api/v1/auth/key', {
        headers: { 'Authorization': `Bearer ${settings.openrouterKey}` }
      });
      results.openrouter = true;
    } catch (error) {
      console.error('OpenRouter test failed:', error.message);
    }
  }
  
  res.json(results);
});

// Protected API Endpoints
app.get('/api/usage', requireAuth, (req, res) => {
  res.json(usageData);
});

app.post('/api/refresh', requireAuth, async (req, res) => {
  await updateUsageData();
  res.json({ success: true, data: usageData });
});

app.get('/api/recommendations', requireAuth, (req, res) => {
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

// Initialize
(async () => {
  try {
    await loadSettings();
    console.log('Settings loaded successfully');
  } catch (error) {
    console.log('Could not load settings file, using environment variables:', error.message);
  }
  
  // Update usage every 5 minutes
  cron.schedule('*/5 * * * *', updateUsageData);
  
  // Initial update
  updateUsageData();
  
  app.listen(PORT, () => {
    console.log(`LLM Usage Dashboard running on port ${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}`);
    console.log(`Settings: http://localhost:${PORT}/settings.html`);
  });
})();
