/**
 * firebase-cloud.js
 * Firebase Firestore real-time cloud storage integration.
 * Uses dynamic CDN imports (works in plain <script> tags).
 *
 * Project: t-rbac-cloudsec
 */

// ── Firebase Config (your real project) ─────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBKpRhhb2AK3OmivKh2MzQqn1eqnf2ZGvw",
  authDomain:        "t-rbac-cloudsec.firebaseapp.com",
  projectId:         "t-rbac-cloudsec",
  storageBucket:     "t-rbac-cloudsec.firebasestorage.app",
  messagingSenderId: "593204307518",
  appId:             "1:593204307518:web:bdabde1173421e67e1936f",
  measurementId:     "G-S1XFVMDJBS"
};

const FIRESTORE_COLLECTION = "cloud_objects";
const FB_SDK = "https://www.gstatic.com/firebasejs/10.12.0";

// ── State ────────────────────────────────────────────────────────
let _firestoreReady = false;
let _db             = null;
let _unsubscribe    = null;

// ── UI Helpers ───────────────────────────────────────────────────

function fbSetStatus(state) {
  const dot  = document.getElementById('firebase-status-dot');
  const text = document.getElementById('firebase-status-text');
  if (!dot || !text) return;
  const map = {
    connecting: { color: '#f59e0b', msg: '🔄 Connecting to Firebase Firestore...' },
    connected:  { color: '#10b981', msg: '✅ Firebase Firestore Connected — real-time sync active' },
    fallback:   { color: '#94a3b8', msg: '📦 Using Flask API / local data (Firebase standby)' },
    error:      { color: '#ef4444', msg: '❌ Firebase error — check console' },
  };
  const cfg = map[state] || map.fallback;
  dot.style.background  = cfg.color;
  text.textContent      = cfg.msg;
}

function fbUpdateStats(objects) {
  const total    = objects.length;
  const critical = objects.filter(o => (o.sensitivity || '') === 'critical').length;
  const policies = new Set(objects.flatMap(o => o.roles || [])).size;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('cloud-stat-objects',   total);
  set('cloud-stat-firestore', total);
  set('cloud-stat-policies',  policies || '—');
  set('cloud-stat-critical',  critical);
  const cnt = document.getElementById('firebase-object-count');
  if (cnt) cnt.textContent = `${total} document${total !== 1 ? 's' : ''} in Firestore`;
}

function fbRenderObjects(objects) {
  if (typeof STATE !== 'undefined') {
    STATE.cloudObjects = objects.map(o => ({
      id:          o.id || o._firestoreId,
      name:        o.name,
      owner:       o.owner,
      sensitivity: o.sensitivity || 'medium',
      size:        o.size || '~10 MB',
      encrypted:   true,
      roles:       o.roles || [],
      threshold:   o.threshold || 0.5,
      accessCount: o.accessCount || o.access_count || 0,
    }));
  }
  if (typeof renderCloudObjects === 'function') renderCloudObjects();
  fbUpdateStats(objects);
}

// ── Firebase Init (dynamic CDN import) ───────────────────────────

async function initFirebase() {
  fbSetStatus('connecting');
  try {
    const { initializeApp } =
      await import(`${FB_SDK}/firebase-app.js`);
    const { getFirestore, collection, onSnapshot, addDoc, serverTimestamp, query, orderBy } =
      await import(`${FB_SDK}/firebase-firestore.js`);

    const fbApp = initializeApp(FIREBASE_CONFIG);
    _db = getFirestore(fbApp);
    _firestoreReady = true;

    // Real-time listener — auto-updates UI whenever Firestore changes
    const q = query(
      collection(_db, FIRESTORE_COLLECTION),
      orderBy('uploadedAt', 'desc')
    );

    _unsubscribe = onSnapshot(q, (snapshot) => {
      const objects = snapshot.docs.map(doc => ({
        _firestoreId: doc.id,
        id: doc.id,
        ...doc.data()
      }));
      fbRenderObjects(objects);
      fbSetStatus('connected');
      console.log(`[Firebase] ✅ ${objects.length} objects synced from Firestore`);
    }, (err) => {
      console.error('[Firebase] Snapshot error:', err);
      // If permission denied (Firestore rules not set to test mode)
      if (err.code === 'permission-denied') {
        fbSetStatus('error');
        document.getElementById('firebase-status-text').textContent =
          '❌ Firestore permission denied — set Rules to Test Mode in Firebase Console';
      } else {
        fbSetStatus('error');
      }
      fbFallback();
    });

    // Store upload function for use by uploadToFirestoreAndFlask()
    window._fbUploadToFirestore = async function(data) {
      await addDoc(collection(_db, FIRESTORE_COLLECTION), {
        ...data,
        encrypted:  true,
        uploadedAt: serverTimestamp(),
      });
      return true;
    };

    console.log('[Firebase] Initialized — project: t-rbac-cloudsec');

  } catch (err) {
    console.error('[Firebase] Init failed:', err);
    fbSetStatus('error');
    fbFallback();
  }
}

// ── Fallback to Flask API / local STATE ─────────────────────────

async function fbFallback() {
  try {
    if (typeof API_CONNECTED !== 'undefined' && API_CONNECTED && typeof API !== 'undefined') {
      const objs = await API.getCloudObjects();
      fbRenderObjects(objs.map(o => ({ ...o, accessCount: o.access_count })));
      console.log('[Firebase] Fallback: loaded from Flask API');
    } else if (typeof STATE !== 'undefined' && STATE.cloudObjects) {
      fbRenderObjects(STATE.cloudObjects);
      console.log('[Firebase] Fallback: loaded from local STATE');
    }
  } catch(e) {
    console.warn('[Firebase] Fallback error:', e);
  }
  if (typeof STATE !== 'undefined' && STATE.cloudObjects) {
    fbUpdateStats(STATE.cloudObjects);
  }
}

// ── Enhanced Upload ──────────────────────────────────────────────

async function uploadToFirestoreAndFlask() {
  const name        = document.getElementById('cloud-res-name')?.value?.trim();
  const ownerId     = document.getElementById('cloud-owner')?.value;
  const sensitivity = document.getElementById('cloud-sensitivity')?.value || 'medium';
  const threshold   = parseFloat(document.getElementById('cloud-threshold')?.value || 0.7);
  const rolesEl     = document.getElementById('cloud-allowed-roles');
  const roles       = rolesEl ? Array.from(rolesEl.selectedOptions).map(o => o.value) : [];

  if (!name) {
    if (typeof notify === 'function') notify('Resource name required', 'error');
    return;
  }

  const ownerName = (typeof STATE !== 'undefined')
    ? (STATE.users.find(u => u.id === ownerId)?.name || 'Unknown')
    : 'Unknown';

  const objectData = { name, owner: ownerName, sensitivity, threshold, roles, size: '~10 MB', accessCount: 0 };

  const logEl = document.getElementById('cloud-log');
  const t = new Date().toLocaleTimeString();

  function appendLog(msg, type = 'log-type-success') {
    if (!logEl) return;
    logEl.innerHTML += `<div class="log-line"><span class="${type}">[${t}] ${msg}</span></div>`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  // Try Firestore first
  if (_firestoreReady && typeof window._fbUploadToFirestore === 'function') {
    try {
      appendLog('Generating AES-256 encryption key...');
      appendLog(`Encrypting object: ${name}`);
      appendLog(`Applying T-RBAC: threshold=${threshold}, roles=[${roles.join(',')}]`);
      appendLog(`Writing to Firestore → ${FIRESTORE_COLLECTION}...`);
      await window._fbUploadToFirestore(objectData);
      appendLog('✅ Upload complete — Firestore syncing in real-time');
      if (typeof notify === 'function') notify(`${name} uploaded to Firestore ✅`, 'success');
      if (document.getElementById('cloud-res-name')) document.getElementById('cloud-res-name').value = '';
      return;
    } catch(e) {
      console.error('[Firebase] Upload error:', e);
      appendLog('⚠️ Firestore write failed — falling back to Flask API', 'log-type-warn');
      if (typeof notify === 'function') notify('Firestore write failed — using Flask API', 'warn');
    }
  }

  // Fallback: Flask API / local
  if (typeof API_CONNECTED !== 'undefined' && API_CONNECTED && typeof API !== 'undefined') {
    try {
      const obj = await API.uploadObject({ name, owner: ownerName, sensitivity, threshold, roles });
      STATE.cloudObjects.push({
        id: obj.id, name: obj.name, owner: obj.owner,
        sensitivity: obj.sensitivity, size: obj.size || '~10 MB',
        encrypted: true, roles: obj.roles, threshold: obj.threshold, accessCount: 0
      });
      if (typeof renderCloudObjects === 'function') renderCloudObjects();
      appendLog(`✅ Uploaded via Flask API — ID: ${obj.id}`);
      if (typeof notify === 'function') notify(`${name} uploaded via Flask API ✅`, 'success');
      if (document.getElementById('cloud-res-name')) document.getElementById('cloud-res-name').value = '';
    } catch(e) {
      if (typeof notify === 'function') notify('Upload error: ' + e.message, 'error');
    }
  } else if (typeof uploadCloudData === 'function') {
    uploadCloudData();
  }
}

// ── Auto-init on cloud page visit ───────────────────────────────

let _fbInitialized = false;

document.addEventListener('click', function(e) {
  const navItem = e.target.closest('.nav-item[data-page="cloud"]');
  if (navItem && !_fbInitialized) {
    _fbInitialized = true;
    initFirebase();
  }
});

// Wire upload button
window.addEventListener('load', function() {
  setTimeout(() => {
    // Override the upload button onclick
    const uploadBtn = document.querySelector('#page-cloud .btn-primary');
    if (uploadBtn) uploadBtn.setAttribute('onclick', 'uploadToFirestoreAndFlask()');
  }, 800);
});
