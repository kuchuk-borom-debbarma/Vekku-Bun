// State
let authToken = localStorage.getItem('vekku_token') || null;
let currentUser = null;

// Config
const getApiUrl = () => document.getElementById('apiUrl').value.replace(/\/$/, '');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    checkHealth();
    if (authToken) {
        // Ideally verify token validity here, for now just assume valid state
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
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

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
        if (res.token) {
            handleLoginSuccess(res.token, res.user);
        }
    } catch (e) {}
}

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPass').value;

    try {
        const res = await apiCall('/auth/login', 'POST', { email, password });
        if (res.token) {
            handleLoginSuccess(res.token, res.user); // Assuming backend returns user info
        }
    } catch (e) {}
}

function handleLoginSuccess(token, user) {
    authToken = token;
    currentUser = user || { name: 'User' }; // Fallback
    localStorage.setItem('vekku_token', token);
    showAuthenticatedState();
}

function showAuthenticatedState() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('signupForm').classList.add('hidden');
    document.getElementById('userProfile').classList.remove('hidden');
    
    document.getElementById('userNameDisplay').textContent = currentUser?.name || 'User';
    document.getElementById('tokenDisplay').textContent = authToken.substring(0, 15) + '...';

    // Auto load data
    fetchTags();
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('vekku_token');
    
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
    if (!authToken) return;
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
    if (!name) return;
    
    try {
        await apiCall('/tag', 'POST', { name });
        document.getElementById('newTagName').value = '';
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
    if (!authToken) return;
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
                <strong>${item.title}</strong>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9em;">${item.body.substring(0, 50)}...</p>
            </div>
            <button class="danger" style="width:auto; padding: 2px 8px; font-size: 0.8em;" onclick="deleteContent('${item.id}')">Delete</button>
        `;
        list.appendChild(li);
    });
}

async function createContent() {
    const title = document.getElementById('contentTitle').value;
    const body = document.getElementById('contentBody').value;
    const contentType = document.getElementById('contentType').value;

    if (!title || !body) return;

    try {
        await apiCall('/content', 'POST', { title, body, contentType });
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
