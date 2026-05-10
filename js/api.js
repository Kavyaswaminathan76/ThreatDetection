/**
 * T-RBAC API Client
 * Replaces the hardcoded STATE object with real Flask API calls.
 * Base URL: http://localhost:5000
 */

const API_BASE = 'http://localhost:5000/api';

// ── Generic fetch helpers ──────────────────────────────────────

async function apiGet(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'API error');
  return json.data;
}

async function apiPost(endpoint, body = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'API error');
  return json.data;
}

async function apiPut(endpoint, body = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'API error');
  return json.data;
}

async function apiDelete(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'API error');
  return json.data;
}

// ── API endpoints ──────────────────────────────────────────────

const API = {
  // Users
  getUsers:       ()        => apiGet('/users'),
  addUser:        (data)    => apiPost('/users', data),
  updateUser:     (id, d)   => apiPut(`/users/${id}`, d),
  deleteUser:     (id)      => apiDelete(`/users/${id}`),

  // Tasks
  getTasks:       ()        => apiGet('/tasks'),
  addTask:        (data)    => apiPost('/tasks', data),

  // Roles
  getRoles:       ()        => apiGet('/roles'),

  // Access
  evaluateAccess: (data)    => apiPost('/access/evaluate', data),
  getAccessHistory: ()      => apiGet('/access/history'),

  // Trust / Recommendations
  submitFeedback: (data)    => apiPost('/recommendations', data),
  getRecommendations: ()    => apiGet('/recommendations'),

  // Audit logs
  getAudit:       (type='') => apiGet(`/audit${type ? '?type=' + type : ''}`),
  clearAudit:     ()        => apiDelete('/audit'),

  // Cloud storage
  getCloudObjects: ()       => apiGet('/cloud/objects'),
  uploadObject:   (data)    => apiPost('/cloud/upload', data),

  // Attack stats
  getAttackStats: ()        => apiGet('/attacks/stats'),
  logAttack:      (data)    => apiPost('/attacks/simulate', data),

  // ML Model
  getMLInfo:      ()        => apiGet('/ml/info'),
  predictML:      (features)=> apiPost('/ml/predict', features),
  retrainML:      ()        => apiPost('/ml/retrain'),
  retrainStatus:  ()        => apiGet('/ml/retrain/status'),
};

// ── Connection check ───────────────────────────────────────────

let API_CONNECTED = false;

async function checkAPIConnection() {
  try {
    await fetch(`${API_BASE}/users`, { signal: AbortSignal.timeout(3000) });
    API_CONNECTED = true;
    document.getElementById('conn-status').textContent = '● FLASK API CONNECTED';
    document.getElementById('conn-status').style.color = 'var(--accent3)';
    console.log('[API] Connected to Flask backend');
  } catch {
    API_CONNECTED = false;
    document.getElementById('conn-status').textContent = '● OFFLINE (Static Mode)';
    document.getElementById('conn-status').style.color = 'var(--warn)';
    console.warn('[API] Flask not reachable — running in offline/static mode');
  }
}
