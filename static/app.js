// Authentication state
let isAuthenticated = false;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');

// Check authentication status on load
async function checkAuth() {
    try {
        const response = await fetch('/api/auth-status');
        const data = await response.json();
        
        if (data.authenticated) {
            showDashboard();
            loadDashboardData();
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showLogin();
    }
}

// Show login screen
function showLogin() {
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
    isAuthenticated = false;
}

// Show dashboard screen
function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    isAuthenticated = true;
}

// Handle login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    loginError.textContent = '';
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showDashboard();
            loadDashboardData();
        } else {
            loginError.textContent = 'Invalid password';
        }
    } catch (error) {
        loginError.textContent = 'Login failed. Please try again.';
        console.error('Login error:', error);
    }
});

// Handle logout
logoutBtn.addEventListener('click', async () => {
    try {
        await fetch('/api/logout', { method: 'POST' });
        showLogin();
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Refresh data
refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '⏳';
    
    try {
        await fetch('/api/refresh', { method: 'POST' });
        await loadDashboardData();
    } catch (error) {
        console.error('Refresh error:', error);
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '🔄';
    }
});

// Load dashboard data
async function loadDashboardData() {
    try {
        const [usageResponse, recsResponse] = await Promise.all([
            fetch('/api/usage'),
            fetch('/api/recommendations')
        ]);
        
        if (usageResponse.status === 401 || recsResponse.status === 401) {
            showLogin();
            return;
        }
        
        const usage = await usageResponse.json();
        const recommendations = await recsResponse.json();
        
        updateUI(usage, recommendations);
    } catch (error) {
        console.error('Data load error:', error);
    }
}

// Update UI with data
function updateUI(usage, recommendations) {
    // Update last update time
    const lastUpdate = new Date().toLocaleString();
    document.getElementById('last-update').textContent = lastUpdate;
    
    // Update providers
    updateProvider('openai', usage.openai);
    updateProvider('anthropic', usage.anthropic);
    updateProvider('openrouter', usage.openrouter);
    
    // Update KPIs
    updateKPIs(usage);
    
    // Update recommendations
    updateRecommendations(recommendations);
}

// Update individual provider
function updateProvider(provider, data) {
    if (!data) return;
    
    // Tokens and cost
    const tokens = data.tokens || 0;
    const cost = data.cost || 0;
    
    document.getElementById(`${provider}-tokens`).textContent = 
        tokens.toLocaleString();
    document.getElementById(`${provider}-cost`).textContent = 
        `$${cost.toFixed(2)}`;
    
    // Billing cycle
    if (data.billingCycle) {
        const { daysRemaining, progress } = data.billingCycle;
        
        document.getElementById(`${provider}-days`).textContent = 
            `${daysRemaining} days left`;
        document.getElementById(`${provider}-progress`).style.width = 
            `${progress}%`;
        document.getElementById(`${provider}-percent`).textContent = 
            `${progress}%`;
    }
}

// Update KPIs
function updateKPIs(usage) {
    const totalCost = (usage.openai.cost || 0) + 
                      (usage.anthropic.cost || 0) + 
                      (usage.openrouter.cost || 0);
    
    const totalTokens = (usage.openai.tokens || 0) + 
                        (usage.anthropic.tokens || 0) + 
                        (usage.openrouter.tokens || 0);
    
    const avgCost = totalTokens > 0 ? totalCost / totalTokens : 0;
    
    // Simple projection based on billing cycle progress
    const avgProgress = (
        (usage.openai.billingCycle?.progress || 0) +
        (usage.anthropic.billingCycle?.progress || 0) +
        (usage.openrouter.billingCycle?.progress || 0)
    ) / 3;
    
    const projected = avgProgress > 0 ? 
        (totalCost / avgProgress) * 100 : totalCost;
    
    document.getElementById('kpi-total-cost').textContent = 
        `$${totalCost.toFixed(2)}`;
    document.getElementById('kpi-total-tokens').textContent = 
        totalTokens.toLocaleString();
    document.getElementById('kpi-avg-cost').textContent = 
        `$${avgCost.toFixed(6)}`;
    document.getElementById('kpi-projected').textContent = 
        `$${projected.toFixed(2)}`;
}

// Update recommendations
function updateRecommendations(recommendations) {
    const container = document.getElementById('recommendations-list');
    
    if (!recommendations || recommendations.length === 0) {
        container.innerHTML = 
            '<p class="no-recommendations">No recommendations at this time. Everything looks good! ✅</p>';
        return;
    }
    
    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item ${rec.severity}">
            <strong>${rec.type.toUpperCase()}:</strong> ${rec.message}
        </div>
    `).join('');
}

// Auto-refresh every 5 minutes
setInterval(loadDashboardData, 5 * 60 * 1000);

// Initialize
checkAuth();
