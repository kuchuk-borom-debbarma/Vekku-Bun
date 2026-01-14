// State
let accessToken = localStorage.getItem('vekku_access_token') || null;
let refreshToken = localStorage.getItem('vekku_refresh_token') || null;
let currentUser = null;

// Config
const getApiUrl = () => document.getElementById('apiUrl').value.replace(/\/$/, '');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    checkHealth();
    
    // Auto-fill inputs if tokens exist in local storage
    if (accessToken) document.getElementById('accessTokenInput').value = accessToken;
    if (refreshToken) document.getElementById('refreshTokenInput').value = refreshToken;

    if (accessToken) {
        // Ideally verify token validity here, for now just assume valid state
        // We can try to decode the token payload if we had a library, but simple is fine.
        showAuthenticatedState();
    }
});

// Logging Helper
function log(title, data, isError = false) {
    const logArea = document.getElementById('apiLog');
    const entry = document.createElement('div');
    entry.style.borderBottom = '1px solid #334155';
    entry.style.padding = '10px 0';
    entry.style.color = isError ? '#ef4444' : '#10b981';
    
    const timestamp = new Date().toLocaleTimeString();
    entry.innerHTML = `<strong>[${timestamp}] ${title}</strong><br>${JSON.stringify(data, null, 2)}`;
    
    logArea.prepend(entry);
    
    // Auto-switch to console on error
    if (isError) showTab('console');
}

async function apiCall(endpoint, method = 'GET', body = null) {
    const url = `${getApiUrl()}${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    
    // Always grab the latest token from the input field to ensure we use what the user sees
    const currentToken = document.getElementById('accessTokenInput').value || accessToken;
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    log(`Request: ${method} ${endpoint}`, body || {});

    try {
        const res = await fetch(url, options);
        const data = await res.json();
        
        if (!res.ok) throw data;
        
        log(`Response: ${method} ${endpoint}`, data);
        return data;
    } catch (err) {
        log(`Error: ${method} ${endpoint}`, err, true);
        alert(`Error: ${err.message || 'Unknown error occurred'}`);
        throw err;
    }
}

// --- Auth Functions ---

async function checkHealth() {
    const statusEl = document.getElementById('connectionStatus');
    try {
        await fetch(`${getApiUrl()}/health`);
        statusEl.textContent = 'Online';
        statusEl.className = 'status-badge status-ok';
    } catch (e) {
        statusEl.textContent = 'Offline';
        statusEl.className = 'status-badge status-err';
    }
}

function toggleAuthMode(mode) {
    if (mode === 'signup') {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('signupForm').classList.remove('hidden');
    } else {
        document.getElementById('signupForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
    }
}

async function requestSignup() {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPass').value;
    const name = document.getElementById('signupName').value;

    try {
        await apiCall('/auth/signup/request', 'POST', { email, password, name });
        alert('Signup requested! Check server logs for token.');
    } catch (e) {}
}

async function verifySignup() {
    const token = document.getElementById('verifyToken').value;
    try {
        const res = await apiCall(`/auth/signup/verify?token=${token}`);
        if (res.user) {
            alert('Verification successful! You can now log in.');
            toggleAuthMode('login');
        }
    } catch (e) {}
}

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPass').value;

    try {
        const res = await apiCall('/auth/login', 'POST', { email, password });
        // The backend returns { user, accessToken, refreshToken }
        if (res.accessToken) {
            handleLoginSuccess(res.accessToken, res.refreshToken, res.user);
        } else {
            log('Login Error', 'No accessToken in response', true);
            alert('Login successful but no access token received.');
        }
    } catch (e) {}
}

function handleLoginSuccess(access, refresh, user) {
    console.log("Handling login success:", { access, refresh, user });
    
    accessToken = access;
    refreshToken = refresh;
    currentUser = user || { name: 'User' }; 
    
    localStorage.setItem('vekku_access_token', access);
    localStorage.setItem('vekku_refresh_token', refresh);
    
    const accessInput = document.getElementById('accessTokenInput');
    const refreshInput = document.getElementById('refreshTokenInput');
    
    if (accessInput) accessInput.value = access;
    else console.error("Element accessTokenInput not found!");
    
    if (refreshInput) refreshInput.value = refresh;
    else console.error("Element refreshTokenInput not found!");
    
    showAuthenticatedState();
}

function updateTokensFromInput() {
    const newAccess = document.getElementById('accessTokenInput').value;
    const newRefresh = document.getElementById('refreshTokenInput').value;
    
    accessToken = newAccess;
    refreshToken = newRefresh;
    
    localStorage.setItem('vekku_access_token', newAccess);
    localStorage.setItem('vekku_refresh_token', newRefresh);
    
    alert('Tokens updated in local storage.');
}

function showAuthenticatedState() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('signupForm').classList.add('hidden');
    document.getElementById('userProfile').classList.remove('hidden');
    
    document.getElementById('userNameDisplay').textContent = currentUser?.name || 'User';

    // Auto load data
    fetchTags();
}

function logout() {
    accessToken = null;
    refreshToken = null;
    currentUser = null;
    localStorage.removeItem('vekku_access_token');
    localStorage.removeItem('vekku_refresh_token');
    
    document.getElementById('accessTokenInput').value = '';
    document.getElementById('refreshTokenInput').value = '';
    
    document.getElementById('userProfile').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    
    document.getElementById('tagsList').innerHTML = '<li>Login to see tags</li>';
    document.getElementById('contentList').innerHTML = '<li>Login to see content</li>';
}

// --- Tabs ---

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    // Simple active class toggle logic for buttons
    const buttons = document.querySelectorAll('.tab-btn');
    if (tabName === 'tags') buttons[0].classList.add('active');
    if (tabName === 'content') buttons[1].classList.add('active');
    if (tabName === 'console') buttons[2].classList.add('active');
}

// --- Tags ---

async function fetchTags() {
    // If we have an access token (either in variable or input), try fetching
    const currentToken = document.getElementById('accessTokenInput').value || accessToken;
    if (!currentToken) return;

    try {
        const res = await apiCall('/tag');
        renderTags(res.data || res); // Handle paginated or list response
    } catch (e) {}
}

function renderTags(tags) {
    const list = document.getElementById('tagsList');
    list.innerHTML = '';
    
    if (!tags || tags.length === 0) {
        list.innerHTML = '<li>No tags found.</li>';
        return;
    }

    tags.forEach(tag => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span><strong>${tag.name}</strong> <small>(${tag.id})</small></span>
            <button class="danger" style="width:auto; padding: 2px 8px; font-size: 0.8em;" onclick="deleteTag('${tag.id}')">Delete</button>
        `;
        list.appendChild(li);
    });
}

async function createTag() {
    const name = document.getElementById('newTagName').value;
    const semantic = document.getElementById('newTagSemantic').value;
    
    if (!name || !semantic) {
        alert("Name and Semantic Concept are required");
        return;
    }
    
    try {
        await apiCall('/tag', 'POST', { name, semantic });
        document.getElementById('newTagName').value = '';
        document.getElementById('newTagSemantic').value = '';
        fetchTags();
    } catch (e) {}
}

async function deleteTag(id) {
    if(!confirm('Delete this tag?')) return;
    try {
        await apiCall(`/tag/${id}`, 'DELETE');
        fetchTags();
    } catch (e) {}
}

// --- Content ---

async function fetchContent() {
    const currentToken = document.getElementById('accessTokenInput').value || accessToken;
    if (!currentToken) return;

    try {
        const res = await apiCall('/content');
        renderContent(res.data || res);
    } catch (e) {}
}

function renderContent(contents) {
    const list = document.getElementById('contentList');
    list.innerHTML = '';

    if (!contents || contents.length === 0) {
        list.innerHTML = '<li>No content found.</li>';
        return;
    }

    contents.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${item.title}</strong> <small>(${item.contentType})</small>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9em;">${item.body.substring(0, 50)}...</p>
            </div>
            <div>
                <button class="secondary" style="width:auto; padding: 2px 8px; font-size: 0.8em; margin-right: 5px;" onclick="fetchSuggestions('${item.id}')">Suggestions</button>
                <button class="danger" style="width:auto; padding: 2px 8px; font-size: 0.8em;" onclick="deleteContent('${item.id}')">Delete</button>
            </div>
        `;
        list.appendChild(li);
    });
}

async function createContent() {
    const title = document.getElementById('contentTitle').value;
    const content = document.getElementById('contentBody').value; // Mapped to 'content' in payload
    const contentType = document.getElementById('contentType').value;

    if (!title || !content) return;

    try {
        await apiCall('/content', 'POST', { title, content, contentType });
        document.getElementById('contentTitle').value = '';
        document.getElementById('contentBody').value = '';
        fetchContent();
        showTab('content');
    } catch (e) {}
}

async function deleteContent(id) {
    if(!confirm('Delete this content?')) return;
    try {
        await apiCall(`/content/${id}`, 'DELETE');
        fetchContent();
    } catch (e) {}
}

async function fetchSuggestions(contentId) {
    try {
        const res = await apiCall(`/suggestions/content/${contentId}`);
        renderSuggestions(res);
    } catch (e) {}
}

function renderSuggestions(suggestions) {
    const area = document.getElementById('suggestionsArea');
    const list = document.getElementById('suggestionsList');
    list.innerHTML = '';
    
    if (!suggestions || suggestions.length === 0) {
        list.innerHTML = '<li>No suggestions found.</li>';
    } else {
        suggestions.forEach(s => {
            const li = document.createElement('li');
            li.style.borderBottom = '1px solid #bae6fd';
            li.style.padding = '8px 0';
            
            // s.tagId, s.name, s.score are returned by backend
            const tagName = s.name || 'Unknown Tag';
            const score = parseFloat(s.score).toFixed(4); // Format score
            
            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 500; color: #0c4a6e;">${tagName}</span>
                    <span style="font-family: monospace; font-size: 0.85em; background: #fff; padding: 2px 6px; border-radius: 4px; color: #0284c7;">
                        Score: ${score}
                    </span>
                </div>
            `;
            list.appendChild(li);
        });
    }
    
    area.classList.remove('hidden');
}