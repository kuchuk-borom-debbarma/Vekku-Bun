// State
let accessToken = localStorage.getItem('vekku_access_token') || null;
let refreshToken = localStorage.getItem('vekku_refresh_token') || null;
let currentUser = null;

// Config
const getApiUrl = () => document.getElementById('apiUrl').value.replace(/\/$/, '');

async function testNotification() {
    const email = document.getElementById('testNotifEmail').value || 'kuchukboromd@gmail.com';
    try {
        const res = await apiCall(`/admin/notifications/test-send?email=${encodeURIComponent(email)}`);
        alert(res.message);
    } catch (e) {
        // apiCall handles logging
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // URL Preset Logic
    const urlPreset = document.getElementById('urlPreset');
    const apiUrlInput = document.getElementById('apiUrl');

    if (urlPreset && apiUrlInput) {
        urlPreset.addEventListener('change', (e) => {
            if (e.target.value !== 'custom') {
                apiUrlInput.value = e.target.value;
            }
        });

        apiUrlInput.addEventListener('input', () => {
            urlPreset.value = 'custom';
        });
    }

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

async function refreshTokenFunc() {
    const currentRefresh = document.getElementById('refreshTokenInput').value;
    if (!currentRefresh) {
        alert("No refresh token available");
        return;
    }

    try {
        const res = await apiCall('/auth/refresh', 'POST', { refreshToken: currentRefresh });
        if (res.accessToken && res.refreshToken) {
            handleLoginSuccess(res.accessToken, res.refreshToken, res.user);
            log('Token Refresh', 'Success', false);
            alert('Tokens refreshed successfully!');
        }
    } catch (e) {
        log('Token Refresh Error', e, true);
    }
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
            <div style="display: flex; gap: 5px;">
                <button class="secondary" style="width:auto; padding: 2px 8px; font-size: 0.8em; background-color: #8b5cf6;" onclick="relearnTag('${tag.id}')">Relearn</button>
                <button class="danger" style="width:auto; padding: 2px 8px; font-size: 0.8em;" onclick="deleteTag('${tag.id}')">Delete</button>
            </div>
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

async function relearnTag(id) {
    if(!confirm('Relearn embedding for this tag?')) return;
    try {
        await apiCall(`/suggestions/tags/relearn`, 'POST', { tagIds: [id] });
        alert('Tag relearn triggered.');
    } catch (e) {}
}

// --- Content ---

async function fetchContentTags(contentId) {
    try {
        const res = await apiCall(`/content/${contentId}/tags`);
        return res.data || res;
    } catch (e) {
        return [];
    }
}

async function addContentTag(contentId) {
    const select = document.getElementById(`tag-select-${contentId}`);
    const tagId = select.value;
    if(!tagId) return;

    try {
        await apiCall(`/content/${contentId}/tags`, 'POST', { tagIds: [tagId] });
        toggleTagManager(contentId, true); 
    } catch (e) {}
}

async function removeContentTag(contentId, tagId) {
    if(!confirm("Remove tag?")) return;
    try {
        await apiCall(`/content/${contentId}/tags`, 'DELETE', { tagIds: [tagId] });
        toggleTagManager(contentId, true);
    } catch (e) {}
}

async function toggleTagManager(contentId, forceRefresh = false) {
    const mgr = document.getElementById(`tag-manager-${contentId}`);
    
    if (!forceRefresh) {
        if (mgr.classList.contains('hidden')) {
            mgr.classList.remove('hidden');
        } else {
            mgr.classList.add('hidden');
            return; 
        }
    }

    const chipsContainer = document.getElementById(`tag-chips-${contentId}`);
    const select = document.getElementById(`tag-select-${contentId}`);
    
    chipsContainer.innerHTML = 'Loading...';
    
    // Parallel fetch: Assigned Tags & All Tags
    // We fetch all tags to populate the dropdown
    const [assignedTags, allTagsRes] = await Promise.all([
        fetchContentTags(contentId),
        apiCall('/tag')
    ]);

    const allTags = allTagsRes.data || allTagsRes;

    // Render Assigned Tags
    chipsContainer.innerHTML = '';
    if (!assignedTags || assignedTags.length === 0) {
        chipsContainer.innerHTML = '<span style="font-size:0.8em; color:#666;">No tags assigned</span>';
    } else {
        assignedTags.forEach(tag => {
            const chip = document.createElement('div');
            chip.className = 'tag-chip';
            chip.innerHTML = `
                ${tag.name}
                <button onclick="removeContentTag('${contentId}', '${tag.id}')">&times;</button>
            `;
            chipsContainer.appendChild(chip);
        });
    }

    // Render Dropdown
    select.innerHTML = '';
    const assignedIds = new Set((assignedTags || []).map(t => t.id));
    
    let hasOptions = false;
    allTags.forEach(tag => {
        if (!assignedIds.has(tag.id)) {
            const opt = document.createElement('option');
            opt.value = tag.id;
            opt.textContent = tag.name;
            select.appendChild(opt);
            hasOptions = true;
        }
    });
    
    if (!hasOptions) {
        const opt = document.createElement('option');
        opt.textContent = "No other tags available";
        select.appendChild(opt);
    }
}

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
            <div style="flex: 1; padding-right: 10px;">
                <strong>${item.title}</strong> <small>(${item.contentType})</small>
                <p style="margin: 5px 0 10px 0; color: #666; font-size: 0.9em;">${item.body.substring(0, 100)}...</p>
                
                <!-- Tag Manager -->
                <div id="tag-manager-${item.id}" class="tag-manager hidden">
                    <div style="margin-bottom:5px; font-weight:bold; font-size:0.9em;">Assigned Tags</div>
                    <div id="tag-chips-${item.id}" class="tag-chips">Loading...</div>
                    <div class="add-tag-row">
                         <select id="tag-select-${item.id}"><option>Loading tags...</option></select>
                         <button style="width:auto; padding: 2px 8px; background-color: #0ea5e9;" onclick="addContentTag('${item.id}')">Add Tag</button>
                    </div>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:5px; min-width: 120px;">
                <button class="secondary" style="width:100%; padding: 4px; font-size: 0.8em;" onclick="fetchSuggestions('${item.id}')">View Suggestions</button>
                <button class="secondary" style="width:100%; padding: 4px; font-size: 0.8em; background-color: #10b981; color: white; border:none;" onclick="regenerateSuggestions('${item.id}')">Regenerate</button>
                <button class="secondary" style="width:100%; padding: 4px; font-size: 0.8em; background-color: #6366f1; color: white; border:none;" onclick="toggleTagManager('${item.id}')">Manage Tags</button>
                <button class="danger" style="width:100%; padding: 4px; font-size: 0.8em;" onclick="deleteContent('${item.id}')">Delete</button>
            </div>
        `;
        list.appendChild(li);
    });
}

async function createContent() {
    const title = document.getElementById('contentTitle').value;
    const content = document.getElementById('contentBody').value; 
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
        const res = await apiCall(`/suggestions/generate`, 'POST', { contentId });
        renderSuggestions(res, contentId);
    } catch (e) {}
}

async function regenerateSuggestions(contentId) {
    if(!confirm('Refresh suggestions for this content?')) return;
    try {
        const res = await apiCall(`/suggestions/generate`, 'POST', { contentId });
        alert('Suggestions refreshed (from cache if available)!');
        renderSuggestions(res, contentId);
    } catch (e) {}
}

function renderSuggestions(data, contentId) {
    const area = document.getElementById('suggestionsArea');
    const list = document.getElementById('suggestionsList');
    list.innerHTML = '';
    
    const existing = data.existing || [];
    const potential = data.potential || [];

    if (existing.length === 0 && potential.length === 0) {
        list.innerHTML = '<li>No suggestions found.</li>';
    } else {
        // --- Render Existing Tags ---
        if (existing.length > 0) {
            const head = document.createElement('li');
            head.innerHTML = '<strong style="color: #0369a1; font-size: 0.9em; text-transform: uppercase;">Existing Tags</strong>';
            head.style.borderBottom = '1px solid #bae6fd';
            head.style.padding = '10px 0 5px 0';
            list.appendChild(head);

            existing.forEach(s => {
                const li = document.createElement('li');
                li.style.borderBottom = '1px solid #f1f5f9';
                li.style.padding = '8px 0';
                li.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 500; color: #0c4a6e;">${s.name}</span>
                        <div style="display: flex; align-items: center; gap: 10px;">
                             <span style="font-family: monospace; font-size: 0.75em; color: #64748b;">Dist: ${s.score}</span>
                             <button style="width:auto; padding: 2px 8px; font-size: 0.7em; background-color: #0ea5e9;" onclick="addContentTagById('${contentId}', '${s.tagId}')">Add</button>
                        </div>
                    </div>
                `;
                list.appendChild(li);
            });
        }

        // --- Render Potential New Tags ---
        if (potential.length > 0) {
            const head = document.createElement('li');
            head.innerHTML = '<strong style="color: #6d28d9; font-size: 0.9em; text-transform: uppercase; margin-top: 15px; display: block;">New Tag Suggestions</strong>';
            head.style.borderBottom = '1px solid #ddd6fe';
            head.style.padding = '10px 0 5px 0';
            list.appendChild(head);

            potential.forEach(p => {
                const li = document.createElement('li');
                li.style.borderBottom = '1px solid #f1f5f9';
                li.style.padding = '8px 0';
                
                const variants = p.variants && p.variants.length > 0 ? `<div style="font-size: 0.7em; color: #94a3b8;">Variants: ${p.variants.join(', ')}</div>` : '';
                
                li.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="font-weight: 500; color: #4c1d95;">${p.keyword}</span>
                            ${variants}
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                             <span style="font-family: monospace; font-size: 0.75em; color: #64748b;">Score: ${p.score}</span>
                             <button style="width:auto; padding: 2px 8px; font-size: 0.7em; background-color: #8b5cf6;" onclick="applyPotentialTag('${contentId}', '${p.keyword}')">Create & Add</button>
                        </div>
                    </div>
                `;
                list.appendChild(li);
            });
        }
    }
    
    area.classList.remove('hidden');
}

async function addContentTagById(contentId, tagId) {
    try {
        await apiCall(`/content/${contentId}/tags`, 'POST', { tagIds: [tagId] });
        alert('Tag added!');
    } catch (e) {}
}

async function applyPotentialTag(contentId, keyword) {
    try {
        // 1. Create the tag
        const tag = await apiCall('/tag', 'POST', { name: keyword, semantic: keyword });
        // 2. Link it to content
        await apiCall(`/content/${contentId}/tags`, 'POST', { tagIds: [tag.id] });
        alert(`Tag "${keyword}" created and added!`);
        fetchTags(); // Refresh tag list
    } catch (e) {}
}