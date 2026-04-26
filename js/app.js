// ============================================================
// CORE DATA MODEL
// ============================================================

const STATE = {
  users: [
    { id:'U1', name:'Alice Chen',    email:'alice@hospital.org',  role:'Admin',   task:'T1', trust:0.92, interactions:45, status:'active',  lastSeen:'2min ago' },
    { id:'U2', name:'Bob Martinez',  email:'bob@hospital.org',    role:'Doctor',  task:'T2', trust:0.87, interactions:38, status:'active',  lastSeen:'5min ago' },
    { id:'U3', name:'Carol Singh',   email:'carol@finance.org',   role:'Finance', task:'T4', trust:0.74, interactions:22, status:'active',  lastSeen:'12min ago'},
    { id:'U4', name:'David Kim',     email:'david@gov.org',       role:'Analyst', task:'T3', trust:0.68, interactions:31, status:'active',  lastSeen:'1hr ago'  },
    { id:'U5', name:'Eve Johnson',   email:'eve@hospital.org',    role:'Auditor', task:'T5', trust:0.55, interactions:15, status:'active',  lastSeen:'2hr ago'  },
    { id:'U6', name:'Frank Lee',     email:'frank@hospital.org',  role:'Viewer',  task:'T6', trust:0.43, interactions:8,  status:'active',  lastSeen:'1day ago' },
    { id:'U7', name:'Grace Wu',      email:'grace@finance.org',   role:'Finance', task:'T4', trust:0.81, interactions:27, status:'active',  lastSeen:'30min ago'},
    { id:'U8', name:'Henry Davis',   email:'henry@gov.org',       role:'Analyst', task:'T3', trust:0.39, interactions:6,  status:'suspended',lastSeen:'3day ago'},
    { id:'U9', name:'Iris Brown',    email:'iris@hospital.org',   role:'Doctor',  task:'T2', trust:0.76, interactions:41, status:'active',  lastSeen:'8min ago' },
    { id:'U10',name:'Jack Wilson',   email:'jack@hospital.org',   role:'Viewer',  task:'T6', trust:0.28, interactions:3,  status:'suspended',lastSeen:'5day ago'},
    { id:'U11',name:'Kate Taylor',   email:'kate@finance.org',    role:'Auditor', task:'T5', trust:0.88, interactions:33, status:'active',  lastSeen:'15min ago'},
    { id:'U12',name:'Leo Garcia',    email:'leo@gov.org',         role:'Admin',   task:'T1', trust:0.95, interactions:52, status:'active',  lastSeen:'just now' },
  ],

  tasks: [
    { id:'T1', name:'ManageSystem',     role:'Admin',   permission:'ADMIN',  threshold:0.85, sensitivity:'critical', active:true  },
    { id:'T2', name:'ReadPatientData',  role:'Doctor',  permission:'READ',   threshold:0.75, sensitivity:'high',     active:true  },
    { id:'T3', name:'AnalyzeData',      role:'Analyst', permission:'READ',   threshold:0.60, sensitivity:'medium',   active:true  },
    { id:'T4', name:'ViewFinancials',   role:'Finance', permission:'READ',   threshold:0.70, sensitivity:'high',     active:true  },
    { id:'T5', name:'AuditLogs',        role:'Auditor', permission:'READ',   threshold:0.65, sensitivity:'medium',   active:true  },
    { id:'T6', name:'ViewDashboard',    role:'Viewer',  permission:'READ',   threshold:0.30, sensitivity:'low',      active:true  },
  ],

  roles: {
    'Admin':   { level:5, inherits:['Analyst','Viewer'], threshold:0.85 },
    'Doctor':  { level:4, inherits:['Viewer'],           threshold:0.75 },
    'Finance': { level:3, inherits:['Viewer'],           threshold:0.70 },
    'Analyst': { level:3, inherits:['Viewer'],           threshold:0.60 },
    'Auditor': { level:2, inherits:['Viewer'],           threshold:0.65 },
    'Viewer':  { level:1, inherits:[],                   threshold:0.30 },
  },

  cloudObjects: [
    { id:'OBJ001', name:'Patient_Records_2024', owner:'Alice Chen',    sensitivity:'critical', size:'128 MB', encrypted:true, roles:['Admin','Doctor'],   threshold:0.85, accessCount:12 },
    { id:'OBJ002', name:'Financial_Q3_Report',  owner:'Leo Garcia',    sensitivity:'high',     size:'24 MB',  encrypted:true, roles:['Admin','Finance'], threshold:0.75, accessCount:8  },
    { id:'OBJ003', name:'Gov_Database_Backup',  owner:'Leo Garcia',    sensitivity:'critical', size:'512 MB', encrypted:true, roles:['Admin'],            threshold:0.90, accessCount:3  },
    { id:'OBJ004', name:'Analytics_Dashboard',  owner:'Alice Chen',    sensitivity:'medium',   size:'8 MB',   encrypted:true, roles:['Admin','Analyst'], threshold:0.60, accessCount:22 },
    { id:'OBJ005', name:'Audit_Trail_Log',       owner:'Kate Taylor',   sensitivity:'high',     size:'45 MB',  encrypted:true, roles:['Admin','Auditor'], threshold:0.65, accessCount:7  },
  ],

  recommendations: [],
  accessHistory: [],
  auditLog: [],
  attackStats: { slander:0, self:0, sybil:0, collusion:0 },
};

// ============================================================
// UTILITIES
// ============================================================

function now() {
  return new Date().toLocaleTimeString('en-US', {hour12:false});
}

function fmt(v) { return (Math.round(v*100)/100).toFixed(2); }

function trustClass(v) {
  if(v >= 0.7) return 'trust-high';
  if(v >= 0.4) return 'trust-med';
  return 'trust-low';
}

function trustBarClass(v) {
  if(v >= 0.7) return 'high';
  if(v >= 0.4) return 'medium';
  return 'low';
}

function sensitivityBadge(s) {
  const map = { low:'badge-blue', medium:'badge-yellow', high:'badge-red', critical:'badge-red' };
  return `<span class="badge ${map[s]||'badge-blue'}">${s.toUpperCase()}</span>`;
}

function statusBadge(s) {
  return s === 'active' ? '<span class="badge badge-green">â— ACTIVE</span>' : '<span class="badge badge-red">â›” SUSPENDED</span>';
}

function notify(msg, type='info') {
  const el = document.createElement('div');
  const colors = { info:'var(--accent)', success:'#10b981', warn:'var(--warn)', error:'var(--danger)' };
  const icons = { info:'â„¹ï¸', success:'âœ…', warn:'âš ï¸', error:'âŒ' };
  el.className = 'notif-item';
  el.innerHTML = `<span>${icons[type]}</span><span style="color:${colors[type]}">${msg}</span>`;
  document.getElementById('notif').appendChild(el);
  setTimeout(() => el.style.opacity='0', 3500);
  setTimeout(() => el.remove(), 4000);
}

function addAuditLog(type, msg, level='info') {
  const colors = { info:'log-type-info', success:'log-type-success', warn:'log-type-warn', danger:'log-type-danger' };
  const entry = { time:now(), type, msg, level };
  STATE.auditLog.unshift(entry);
  refreshAuditLog();
}

// ============================================================
// NAVIGATION
// ============================================================

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    const page = item.dataset.page;
    document.getElementById('page-' + page).classList.add('active');
    refreshPage(page);
  });
});

function refreshPage(page) {
  if(page==='dashboard') renderDashboard();
  if(page==='users') renderUsers();
  if(page==='tasks') renderTasks();
  if(page==='access') renderAccessPage();
  if(page==='trust') renderTrustPage();
  if(page==='recommendations') renderRecommendationsPage();
  if(page==='attacks') renderAttacksPage();
  if(page==='cloud') renderCloudPage();
  if(page==='logs') refreshAuditLog();
}

// ============================================================
// DASHBOARD
// ============================================================

function renderDashboard() {
  // Stats
  document.getElementById('s-users').textContent = STATE.users.length;
  const avgTrust = STATE.users.reduce((s,u)=>s+u.trust,0)/STATE.users.length;
  document.getElementById('s-trust').textContent = Math.round(avgTrust*100)+'%';
  document.getElementById('s-pending').textContent = STATE.accessHistory.filter(a=>a.status==='pending').length || 4;
  document.getElementById('s-attacks').textContent = Object.values(STATE.attackStats).reduce((a,b)=>a+b,0);

  // Role trust bars
  const roleTrustMap = {};
  STATE.users.forEach(u => {
    if(!roleTrustMap[u.role]) roleTrustMap[u.role] = [];
    roleTrustMap[u.role].push(u.trust);
  });
  const rtbEl = document.getElementById('role-trust-bars');
  rtbEl.innerHTML = Object.entries(roleTrustMap).map(([role, vals]) => {
    const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
    return `
      <div class="trust-bar-wrap">
        <div class="trust-bar-label">
          <span>${role}</span><span class="trust-val ${trustClass(avg)}">${fmt(avg)}</span>
        </div>
        <div class="trust-bar"><div class="trust-bar-fill ${trustBarClass(avg)}" style="width:${avg*100}%"></div></div>
      </div>`;
  }).join('');

  // Task trust bars
  const ttbEl = document.getElementById('task-trust-bars');
  ttbEl.innerHTML = STATE.tasks.map(t => {
    const users = STATE.users.filter(u=>u.task===t.id);
    const avg = users.length ? users.reduce((s,u)=>s+u.trust,0)/users.length : t.threshold;
    return `
      <div class="trust-bar-wrap">
        <div class="trust-bar-label">
          <span>${t.name}</span><span class="trust-val ${trustClass(avg)}">${fmt(avg)}</span>
        </div>
        <div class="trust-bar"><div class="trust-bar-fill ${trustBarClass(avg)}" style="width:${avg*100}%"></div></div>
      </div>`;
  }).join('');

  // Timeline
  const events = [
    { type:'success', icon:'âœ…', title:'Access Granted', desc:'Alice Chen â†’ Patient Records', time:'2min ago' },
    { type:'danger',  icon:'â›”', title:'Access Denied',   desc:'Henry Davis â†’ Admin Config (trust too low)', time:'15min ago' },
    { type:'warn',    icon:'âš ï¸', title:'Slandering Attempt', desc:'3 malicious recommenders detected', time:'1hr ago' },
    { type:'info',    icon:'ðŸ”', title:'Data Uploaded',   desc:'Leo Garcia encrypted Gov_Database_Backup', time:'2hr ago' },
    { type:'success', icon:'âœ…', title:'Trust Updated',   desc:'Kate Taylor trust: 0.82 â†’ 0.88', time:'3hr ago' },
  ];
  document.getElementById('recent-timeline').innerHTML = events.map(e => `
    <li class="timeline-item">
      <div class="timeline-dot ${e.type}">${e.icon}</div>
      <div class="timeline-content">
        <div class="timeline-title">${e.title}</div>
        <div class="timeline-desc">${e.desc}</div>
        <div class="timeline-time">${e.time}</div>
      </div>
    </li>`).join('');

  // Chart
  const buckets = [0,0,0,0,0]; // 0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0
  STATE.users.forEach(u => {
    const idx = Math.min(4, Math.floor(u.trust/0.2));
    buckets[idx]++;
  });
  const maxB = Math.max(...buckets);
  const colors = ['#ef4444','#f59e0b','#eab308','#10b981','#00d4ff'];
  const labels = ['0-0.2','0.2-0.4','0.4-0.6','0.6-0.8','0.8-1.0'];
  document.getElementById('chart-container').innerHTML = buckets.map((b,i) => `
    <div class="chart-bar-wrap">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:${colors[i]}">${b}</div>
      <div class="chart-bar" style="background:${colors[i]};height:${maxB?b/maxB*100:0}%;min-height:4px"></div>
      <div class="chart-bar-label">${labels[i]}</div>
    </div>`).join('');

  // Metrics
  document.getElementById('avg-trust').textContent = fmt(avgTrust);
  document.getElementById('high-trust-count').textContent = STATE.users.filter(u=>u.trust>=0.7).length;
  document.getElementById('low-trust-count').textContent = STATE.users.filter(u=>u.trust<0.4).length;
}

// ============================================================
// USERS
// ============================================================

function renderUsers(filter='', roleFilter='') {
  const tbody = document.getElementById('users-tbody');
  const filtered = STATE.users.filter(u => {
    const matchSearch = !filter || u.name.toLowerCase().includes(filter.toLowerCase()) || u.email.toLowerCase().includes(filter.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  tbody.innerHTML = filtered.map(u => `
    <tr>
      <td>
        <div style="font-weight:500">${u.name}</div>
        <div style="font-size:11px;color:var(--text3)">${u.email}</div>
      </td>
      <td><span class="badge badge-blue">${u.role}</span></td>
      <td><span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text2)">${u.task}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="trust-val ${trustClass(u.trust)}" style="font-size:14px">${fmt(u.trust)}</span>
          <div style="flex:1;min-width:60px">
            <div class="trust-bar"><div class="trust-bar-fill ${trustBarClass(u.trust)}" style="width:${u.trust*100}%"></div></div>
          </div>
        </div>
      </td>
      <td style="font-family:'IBM Plex Mono',monospace;font-size:12px">${u.interactions}</td>
      <td>${statusBadge(u.status)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="editUserTrust('${u.id}')">Trust</button>
          <button class="btn btn-danger btn-sm" onclick="suspendUser('${u.id}')">${u.status==='active'?'Suspend':'Restore'}</button>
        </div>
      </td>
    </tr>`).join('');

  // Role hierarchy
  const rhEl = document.getElementById('role-hierarchy');
  if(rhEl) {
    rhEl.innerHTML = Object.entries(STATE.roles)
      .sort((a,b)=>b[1].level-a[1].level)
      .map(([role,info]) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="width:${info.level*20}px"></div>
          <span class="badge badge-blue">${role}</span>
          <span style="font-size:11px;color:var(--text3)">L${info.level} â€¢ threshold: ${info.threshold}</span>
          ${info.inherits.length ? `<span style="font-size:11px;color:var(--text3)">inherits: ${info.inherits.join(', ')}</span>` : ''}
        </div>`).join('');
  }

  // Role distribution
  const rdEl = document.getElementById('role-distribution');
  if(rdEl) {
    const roleCounts = {};
    STATE.users.forEach(u => { roleCounts[u.role] = (roleCounts[u.role]||0)+1; });
    rdEl.innerHTML = Object.entries(roleCounts).map(([role,count]) => `
      <div class="trust-bar-wrap">
        <div class="trust-bar-label"><span>${role}</span><span style="color:var(--text2)">${count} users</span></div>
        <div class="trust-bar"><div class="trust-bar-fill" style="width:${count/STATE.users.length*100}%;background:var(--accent2)"></div></div>
      </div>`).join('');
  }
}

function filterUsers() {
  renderUsers(document.getElementById('userSearch').value, document.getElementById('roleFilter').value);
}

function openAddUserModal() { document.getElementById('modal-add-user').classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function addUser() {
  const name = document.getElementById('new-user-name').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const role = document.getElementById('new-user-role').value;
  const trust = parseFloat(document.getElementById('new-user-trust').value);
  if(!name || !email) { notify('Please fill all fields','error'); return; }
  const id = 'U' + (STATE.users.length+1);
  const roleTaskMap = { Admin:'T1', Doctor:'T2', Analyst:'T3', Finance:'T4', Auditor:'T5', Viewer:'T6' };
  STATE.users.push({ id, name, email, role, task:roleTaskMap[role]||'T6', trust, interactions:0, status:'active', lastSeen:'just now' });
  closeModal('modal-add-user');
  renderUsers();
  renderDashboard();
  notify(`User ${name} added successfully`, 'success');
  addAuditLog('USER', `New user added: ${name} (${role}) with trust ${fmt(trust)}`, 'success');
  // Reset
  document.getElementById('new-user-name').value='';
  document.getElementById('new-user-email').value='';
}

function suspendUser(id) {
  const u = STATE.users.find(u=>u.id===id);
  if(u) {
    u.status = u.status==='active' ? 'suspended' : 'active';
    renderUsers();
    notify(`User ${u.name} ${u.status}`, u.status==='suspended'?'warn':'success');
    addAuditLog('USER', `User ${u.name} ${u.status} by administrator`, u.status==='suspended'?'warn':'success');
  }
}

function editUserTrust(id) {
  const u = STATE.users.find(u=>u.id===id);
  if(!u) return;
  const newTrust = parseFloat(prompt(`Enter new trust score for ${u.name} (0-1):`, u.trust));
  if(isNaN(newTrust)||newTrust<0||newTrust>1) { notify('Invalid trust value','error'); return; }
  const old = u.trust;
  u.trust = newTrust;
  renderUsers();
  renderDashboard();
  notify(`Trust updated: ${u.name} ${fmt(old)} â†’ ${fmt(newTrust)}`, 'success');
  addAuditLog('TRUST', `Trust update: ${u.name} changed from ${fmt(old)} to ${fmt(newTrust)}`, 'success');
}

// ============================================================
// TASKS
// ============================================================

function renderTasks() {
  document.getElementById('tasks-tbody').innerHTML = STATE.tasks.map(t => `
    <tr>
      <td style="font-family:'IBM Plex Mono',monospace;color:var(--accent)">${t.id}</td>
      <td style="font-weight:500">${t.name}</td>
      <td><span class="badge badge-blue">${t.role}</span></td>
      <td><span class="badge ${t.permission==='READ'?'badge-green':t.permission==='ADMIN'?'badge-red':'badge-yellow'}">${t.permission}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="trust-val ${trustClass(t.threshold)}" style="font-size:13px">${t.threshold.toFixed(2)}</span>
          <div style="flex:1;min-width:60px">
            <div class="trust-bar"><div class="trust-bar-fill ${trustBarClass(t.threshold)}" style="width:${t.threshold*100}%"></div></div>
          </div>
        </div>
      </td>
      <td>${sensitivityBadge(t.sensitivity)}</td>
      <td><span class="badge ${t.active?'badge-green':'badge-red'}">${t.active?'ACTIVE':'INACTIVE'}</span></td>
    </tr>`).join('');

  // PTA Matrix
  const ptaEl = document.getElementById('pta-matrix');
  const perms = ['READ','WRITE','DELETE','ADMIN'];
  ptaEl.innerHTML = `
    <table>
      <thead><tr><th>Task</th>${perms.map(p=>`<th>${p}</th>`).join('')}<th>Role</th><th>Threshold</th></tr></thead>
      <tbody>${STATE.tasks.map(t=>`
        <tr>
          <td style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--accent)">${t.name}</td>
          ${perms.map(p=>`<td style="text-align:center">${t.permission===p?'<span style="color:#10b981;font-size:16px">âœ“</span>':'<span style="color:var(--text3)">â€”</span>'}</td>`).join('')}
          <td><span class="badge badge-blue">${t.role}</span></td>
          <td class="trust-val ${trustClass(t.threshold)}">${t.threshold}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function openAddTaskModal() { document.getElementById('modal-add-task').classList.add('open'); }

function addTask() {
  const name = document.getElementById('new-task-name').value.trim();
  const role = document.getElementById('new-task-role').value;
  const permission = document.getElementById('new-task-permission').value;
  const threshold = parseFloat(document.getElementById('new-task-threshold').value);
  const sensitivity = document.getElementById('new-task-sensitivity').value;
  if(!name) { notify('Task name required','error'); return; }
  const id = 'T' + (STATE.tasks.length+1);
  STATE.tasks.push({ id, name, role, permission, threshold, sensitivity, active:true });
  closeModal('modal-add-task');
  renderTasks();
  notify(`Task ${name} added`, 'success');
  addAuditLog('TASK', `New task created: ${name} (${role}, ${permission}, threshold:${threshold})`, 'success');
  document.getElementById('new-task-name').value='';
}

// ============================================================
// ACCESS REQUESTS
// ============================================================

function renderAccessPage() {
  populateUserSelect('req-user');
  renderAccessHistory();
}

function populateUserSelect(id) {
  const el = document.getElementById(id);
  if(!el) return;
  el.innerHTML = STATE.users.map(u=>`<option value="${u.id}">${u.name} (${u.role})</option>`).join('');
}

function evaluateAccess() {
  const userId = document.getElementById('req-user').value;
  const resource = document.getElementById('req-resource').value;
  const op = document.getElementById('req-op').value;
  const user = STATE.users.find(u=>u.id===userId);
  if(!user) return;

  // Find matching task
  const task = STATE.tasks.find(t=>t.role===user.role && t.permission.toLowerCase()===op.toLowerCase())
    || STATE.tasks.find(t=>t.role===user.role);

  const threshold = task ? task.threshold : STATE.roles[user.role]?.threshold || 0.5;
  const granted = user.status==='active' && user.trust >= threshold;

  const decision = { time:now(), user:user.name, resource, op:op.toUpperCase(), trust:user.trust, threshold, granted, task:task?.name||'N/A' };
  STATE.accessHistory.unshift(decision);

  // Show result
  const color = granted ? '#10b981' : '#ef4444';
  const icon = granted ? 'âœ…' : 'â›”';
  document.getElementById('access-result').innerHTML = `
    <div style="text-align:center;padding:16px">
      <div style="font-size:48px;margin-bottom:12px">${icon}</div>
      <div style="font-size:20px;font-weight:700;color:${color};margin-bottom:16px">${granted?'ACCESS GRANTED':'ACCESS DENIED'}</div>
    </div>
    <div class="metric-row"><span class="metric-name">Consumer</span><span class="metric-val">${user.name}</span></div>
    <div class="metric-row"><span class="metric-name">Role</span><span class="metric-val"><span class="badge badge-blue">${user.role}</span></span></div>
    <div class="metric-row"><span class="metric-name">Task Evaluated</span><span class="metric-val" style="font-size:12px">${decision.task}</span></div>
    <div class="metric-row"><span class="metric-name">Trust Score</span><span class="metric-val trust-val ${trustClass(user.trust)}">${fmt(user.trust)}</span></div>
    <div class="metric-row"><span class="metric-name">Required Threshold</span><span class="metric-val">${threshold.toFixed(2)}</span></div>
    <div class="metric-row"><span class="metric-name">Resource</span><span class="metric-val" style="font-size:11px">${resource}</span></div>
    <div class="metric-row"><span class="metric-name">Status</span><span class="metric-val">${user.status==='active'?'<span class="badge badge-green">ACTIVE</span>':'<span class="badge badge-red">SUSPENDED</span>'}</span></div>
    <div style="margin-top:12px" class="alert ${granted?'alert-success':'alert-danger'}">
      ${granted
        ? `T-RBAC: User trust (${fmt(user.trust)}) â‰¥ threshold (${threshold.toFixed(2)}) â†’ Permission activated for task ${decision.task}`
        : `T-RBAC: User trust (${fmt(user.trust)}) < threshold (${threshold.toFixed(2)}) OR user is suspended â†’ Access denied`}
    </div>`;

  addAuditLog('ACCESS', `${granted?'GRANTED':'DENIED'}: ${user.name} â†’ ${resource} [${op.toUpperCase()}] (trust:${fmt(user.trust)} threshold:${threshold.toFixed(2)})`, granted?'success':'danger');
  notify(`Access ${granted?'granted':'denied'} for ${user.name}`, granted?'success':'error');
  renderAccessHistory();
}

function renderAccessHistory() {
  const tbody = document.getElementById('access-history-tbody');
  if(!tbody) return;
  tbody.innerHTML = STATE.accessHistory.slice(0,15).map(a => `
    <tr>
      <td style="font-family:'IBM Plex Mono',monospace;font-size:11px">${a.time}</td>
      <td>${a.user}</td>
      <td style="font-size:12px">${a.resource}</td>
      <td><span class="badge badge-blue">${a.op}</span></td>
      <td class="trust-val ${trustClass(a.trust)}">${fmt(a.trust)}</td>
      <td style="font-family:'IBM Plex Mono',monospace">${a.threshold.toFixed(2)}</td>
      <td>${a.granted?'<span class="badge badge-green">GRANTED</span>':'<span class="badge badge-red">DENIED</span>'}</td>
    </tr>`).join('');
}

// ============================================================
// TRUST CALCULATOR
// ============================================================

function renderTrustPage() {
  populateUserSelect('it-user');
  calcIT();
  calcRT();
  renderConditionalTree();
  renderDecaySimulation();
}

function switchTrustTab(tab) {
  document.querySelectorAll('#page-trust .tab').forEach((t,i) => {
    const panels = ['interaction','recommendation','conditional','decay'];
    t.classList.toggle('active', panels[i]===tab);
  });
  document.querySelectorAll('#page-trust .tab-panel').forEach(p => {
    p.classList.toggle('active', p.id==='tp-'+tab);
  });
}

// Core IT formula: IT(R) = Î£ (Î±+PR)/((Î±+PR)+(Î²+NR))
function computeIT(alpha, beta, ii, nf) {
  const PR = (alpha * ii) / Math.max(nf, 1);
  const NR = (beta * ii) / Math.max(nf, 1);
  const alphaNew = alpha + PR;
  const betaNew = beta + NR;
  return alphaNew / (alphaNew + betaNew);
}

function calcIT() {
  const alpha = parseFloat(document.getElementById('page-trust').querySelector('input[type=range]:nth-of-type(1)')?.value||0.8);
  const beta = parseFloat(document.getElementById('page-trust').querySelector('input[type=range]:nth-of-type(2)')?.value||0.2);
  const ii = parseFloat(document.getElementById('page-trust').querySelector('input[type=range]:nth-of-type(3)')?.value||0.7);
  const nf = parseInt(document.getElementById('nf-val')?.value||10);

  // Get actual slider values
  const sliders = document.getElementById('tp-interaction')?.querySelectorAll('input[type=range]');
  if(!sliders||sliders.length<3) return;
  const a = parseFloat(sliders[0].value);
  const b = parseFloat(sliders[1].value);
  const i2 = parseFloat(sliders[2].value);

  document.getElementById('alpha-display').textContent = a.toFixed(2);
  document.getElementById('beta-display').textContent = b.toFixed(2);
  document.getElementById('ii-display').textContent = i2.toFixed(2);

  const PR = (a * i2) / nf;
  const NR = (b * i2) / nf;
  const it = computeIT(a, b, i2, nf);

  document.getElementById('it-value').textContent = fmt(it);

  // Update ring
  const circumference = 364.4;
  const offset = circumference * (1 - it);
  const ring = document.getElementById('it-ring');
  if(ring) ring.style.strokeDashoffset = offset;

  // Color ring
  const color = it >= 0.7 ? '#10b981' : it >= 0.4 ? '#f59e0b' : '#ef4444';
  document.getElementById('it-value').style.color = color;

  // Breakdown
  const bdEl = document.getElementById('it-breakdown');
  if(bdEl) {
    bdEl.innerHTML = `
      <div class="metric-row"><span class="metric-name">Positive Feedback (Î±)</span><span class="metric-val trust-high">${a.toFixed(2)}</span></div>
      <div class="metric-row"><span class="metric-name">Negative Feedback (Î²)</span><span class="metric-val trust-low">${b.toFixed(2)}</span></div>
      <div class="metric-row"><span class="metric-name">Interaction Importance (II)</span><span class="metric-val" style="color:var(--accent)">${i2.toFixed(2)}</span></div>
      <div class="metric-row"><span class="metric-name">PR (positive reinforcement)</span><span class="metric-val">${PR.toFixed(4)}</span></div>
      <div class="metric-row"><span class="metric-name">NR (negative reinforcement)</span><span class="metric-val">${NR.toFixed(4)}</span></div>
      <div class="metric-row"><span class="metric-name">Final IT Score</span><span class="metric-val" style="color:${color}">${fmt(it)}</span></div>`;
  }

  const fEl = document.getElementById('it-formula-display');
  if(fEl) {
    fEl.innerHTML = `<div class="log-line"><span class="log-time">IT</span><span class="log-msg"> = (${a}+${PR.toFixed(4)}) / ((${a}+${PR.toFixed(4)}) + (${b}+${NR.toFixed(4)})) = ${fmt(it)}</span></div>`;
  }
}

function calcRT() {
  const nRec = parseInt(document.getElementById('rt-recommenders')?.value||5);
  const wexEl = document.getElementById('rt-wex');
  const wlEl = document.getElementById('rt-wl');
  if(!wexEl||!wlEl) return;

  const wex = parseInt(wexEl.value);
  const wl = 100 - wex;
  document.getElementById('rt-wex-val').textContent = wex+'%';
  document.getElementById('rt-wl-val').textContent = wl+'%';

  // Generate recommenders
  const recs = [];
  for(let i=0; i<Math.min(nRec,8); i++) {
    const fb = 0.4 + Math.random()*0.5;
    const ex = Math.floor(Math.random()*30)+1;
    const lastT = Math.random();
    const w = (ex * wex/100 + lastT * wl/100) / 100;
    recs.push({ name:`SP${i+1}`, feedback:fb, exchanges:ex, lastTime:lastT.toFixed(2), weight:w });
  }

  // W(Ri, CR) = Î£(EXi*WEX + Li(t)*WL) / 100
  const validRecs = recs.filter(r=>r.weight>=0.3);
  const rt = validRecs.length > 0
    ? validRecs.reduce((s,r)=>s+r.feedback,0)/validRecs.length
    : 0;

  document.getElementById('rt-recommender-list').innerHTML = recs.map(r=>`
    <div class="metric-row">
      <span class="metric-name">${r.name} (EX:${r.exchanges})</span>
      <span class="metric-val trust-val ${trustClass(r.feedback)}">${r.feedback.toFixed(2)}</span>
    </div>`).join('');

  document.getElementById('rt-result').innerHTML = `
    <div style="text-align:center;margin:16px 0">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:36px;font-weight:700;color:${rt>=0.7?'#10b981':rt>=0.4?'#f59e0b':'#ef4444'}">${fmt(rt)}</div>
      <div style="color:var(--text3);font-size:12px;margin-top:4px">RECOMMENDATION TRUST (RT)</div>
    </div>
    <div class="metric-row"><span class="metric-name">Active Recommenders</span><span class="metric-val">${nRec}</span></div>
    <div class="metric-row"><span class="metric-name">Valid (weight â‰¥ 0.3)</span><span class="metric-val">${validRecs.length}</span></div>
    <div class="metric-row"><span class="metric-name">Exchange Weight (WEX)</span><span class="metric-val">${wex}%</span></div>
    <div class="metric-row"><span class="metric-name">Time Weight (WL)</span><span class="metric-val">${wl}%</span></div>
    <div class="trust-bar-wrap" style="margin-top:12px">
      <div class="trust-bar-label"><span>RT Score</span><span class="trust-val ${trustClass(rt)}">${fmt(rt)}</span></div>
      <div class="trust-bar"><div class="trust-bar-fill ${trustBarClass(rt)}" style="width:${rt*100}%"></div></div>
    </div>`;
}

function renderConditionalTree() {
  const el = document.getElementById('conditional-tree');
  if(!el) return;
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      ${Object.entries(STATE.roles).sort((a,b)=>b[1].level-a[1].level).map(([role,info])=>`
        <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:8px;background:var(--surface2);border:1px solid var(--border)">
          <div style="width:${info.level*30}px;height:2px;background:linear-gradient(90deg,var(--accent2),var(--accent));border-radius:1px"></div>
          <span class="badge badge-blue" style="font-size:12px">${role}</span>
          <span style="font-size:12px;color:var(--text2)">Level ${info.level} | Threshold: ${info.threshold}</span>
          ${info.inherits.length ? `<span style="font-size:11px;color:var(--text3)">â† inherits from: ${info.inherits.map(r=>`<span class="badge badge-purple" style="font-size:9px">${r}</span>`).join(' ')}</span>` : ''}
          <div style="margin-left:auto">
            <span class="trust-val ${trustClass(info.threshold)}">${info.threshold}</span>
          </div>
        </div>`).join('')}
    </div>
    <div class="alert alert-info" style="margin-top:14px;font-size:12px">
      In T-RBAC strict inheritance: higher roles only inherit <strong>insignificant tasks</strong> from lower roles. 
      Sensitive tasks are NOT automatically passed up the hierarchy.
    </div>`;
}

function renderDecaySimulation() {
  const el = document.getElementById('decay-simulation');
  if(!el) return;
  // Simulate trust over 10 time periods
  const decayRate = 0.05;
  const periods = Array.from({length:11},(_,i)=>i);
  const initial = 0.85;
  const vals = periods.map(i => Math.max(0, initial * Math.pow(1-decayRate, i)));
  const bars = vals.map((v,i) => `
    <div class="chart-bar-wrap">
      <div style="font-size:9px;color:var(--text3);font-family:'IBM Plex Mono',monospace">${v.toFixed(2)}</div>
      <div style="height:${v*120}px;width:100%;background:${trustClass(v)==='trust-high'?'#10b981':trustClass(v)==='trust-med'?'#f59e0b':'#ef4444'};border-radius:4px 4px 0 0;min-height:4px;transition:height 0.5s"></div>
      <div style="font-size:9px;color:var(--text3)">T+${i}</div>
    </div>`).join('');
  el.innerHTML = `
    <div class="chart-bars" style="height:140px;padding:0 10px;margin-bottom:12px">${bars}</div>
    <div class="metric-row"><span class="metric-name">Initial Trust</span><span class="metric-val trust-high">0.85</span></div>
    <div class="metric-row"><span class="metric-name">Decay Rate per Period</span><span class="metric-val trust-med">5%</span></div>
    <div class="metric-row"><span class="metric-name">Trust at T+10</span><span class="metric-val ${trustClass(vals[10])}">${vals[10].toFixed(3)}</span></div>
    <div class="alert alert-warn" style="margin-top:12px;font-size:12px">
      Without positive interactions, trust decays. Users must maintain active trustworthy behavior to retain access privileges.
    </div>`;
}

// ============================================================
// RECOMMENDATIONS
// ============================================================

function renderRecommendationsPage() {
  populateUserSelect('rec-sp');
  populateUserSelect('rec-consumer');
  renderFeedbackCredibility();
  renderRecLog();
}

function submitFeedback() {
  const spId = document.getElementById('rec-sp').value;
  const consumerId = document.getElementById('rec-consumer').value;
  const fbValue = parseInt(document.getElementById('fb-value').value);
  const ii = parseFloat(document.getElementById('ii-rec').value);

  const sp = STATE.users.find(u=>u.id===spId);
  const consumer = STATE.users.find(u=>u.id===consumerId);
  if(!sp||!consumer||sp===consumer) { notify('Invalid selection','error'); return; }

  // Convert fb (1-100) to 0-1 scale
  const fbNorm = fbValue/100;
  // Credibility check: within Â±0.1 of consumer's current trust
  const spFeedback = consumer.trust; // SP's own assessment
  const range = [spFeedback-0.1, spFeedback+0.1];
  const credible = fbNorm >= range[0] && fbNorm <= range[1];

  const rec = { time:now(), sp:sp.name, consumer:consumer.name, feedback:fbValue, fbNorm, ii, credible, effect:credible?'Positive':'Penalized' };
  STATE.recommendations.unshift(rec);

  if(credible) {
    // Update consumer trust
    const delta = (fbNorm - consumer.trust) * 0.1 * ii;
    consumer.trust = Math.max(0, Math.min(1, consumer.trust + delta));
    consumer.interactions++;
    notify(`Feedback accepted. ${consumer.name} trust updated`, 'success');
    addAuditLog('TRUST', `Feedback from ${sp.name} for ${consumer.name}: ${fbValue}/100 (credible) â†’ trust updated`, 'success');
  } else {
    notify(`Feedback from ${sp.name} is outside valid range â€” penalized`, 'warn');
    addAuditLog('TRUST', `Feedback from ${sp.name} for ${consumer.name}: ${fbValue}/100 REJECTED (outside range Â±0.1)`, 'warn');
  }

  renderFeedbackCredibility();
  renderRecLog();
}

function renderFeedbackCredibility() {
  const el = document.getElementById('feedback-credibility-display');
  if(!el) return;
  if(!STATE.recommendations.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center">Submit feedback to see credibility check</div>';
    return;
  }
  const rec = STATE.recommendations[0];
  el.innerHTML = `
    <div class="metric-row"><span class="metric-name">Recommender</span><span class="metric-val">${rec.sp}</span></div>
    <div class="metric-row"><span class="metric-name">Consumer</span><span class="metric-val">${rec.consumer}</span></div>
    <div class="metric-row"><span class="metric-name">Feedback Value</span><span class="metric-val">${rec.feedback}/100 (${rec.fbNorm.toFixed(2)})</span></div>
    <div class="metric-row"><span class="metric-name">Valid Range (FVR)</span><span class="metric-val">SP_FB Â± 0.1</span></div>
    <div class="metric-row"><span class="metric-name">Credible?</span><span class="metric-val">${rec.credible?'<span class="badge badge-green">YES</span>':'<span class="badge badge-red">NO â€” Penalized</span>'}</span></div>
    <div class="alert ${rec.credible?'alert-success':'alert-danger'}" style="margin-top:12px;font-size:12px">
      ${rec.credible
        ? 'Feedback is within Â±0.1 of SP evaluation. Accepted and applied to trust score.'
        : 'Feedback outside acceptable range. This recommender receives a negative value (Î²).'}
    </div>`;
}

function renderRecLog() {
  const tbody = document.getElementById('rec-log-tbody');
  if(!tbody) return;
  tbody.innerHTML = STATE.recommendations.slice(0,20).map(r=>`
    <tr>
      <td style="font-family:'IBM Plex Mono',monospace;font-size:11px">${r.time}</td>
      <td>${r.sp}</td>
      <td>${r.consumer}</td>
      <td><span class="trust-val ${trustClass(r.fbNorm)}">${r.feedback}/100</span></td>
      <td>${r.ii.toFixed(1)}</td>
      <td>${r.credible?'<span class="badge badge-green">YES</span>':'<span class="badge badge-red">NO</span>'}</td>
      <td>${r.credible?'<span class="badge badge-green">+Trust</span>':'<span class="badge badge-yellow">Penalty</span>'}</td>
    </tr>`).join('');
}

// ============================================================
// ATTACK DETECTION
// ============================================================

function renderAttacksPage() {
  populateUserSelect('slander-target');
  populateUserSelect('sybil-attacker');
  populateUserSelect('collusion-target');
  updateAttackStats();
}

function updateAttackStats() {
  document.getElementById('atk-slander').textContent = STATE.attackStats.slander;
  document.getElementById('atk-self').textContent = STATE.attackStats.self;
  document.getElementById('atk-sybil').textContent = STATE.attackStats.sybil;
  document.getElementById('atk-collusion').textContent = STATE.attackStats.collusion;
}

function switchAttackTab(tab) {
  document.querySelectorAll('#page-attacks .tab').forEach((t,i) => {
    const tabs = ['slander','sybil','collusion'];
    t.classList.toggle('active', tabs[i]===tab);
  });
  document.querySelectorAll('#page-attacks .tab-panel').forEach(p => {
    p.classList.toggle('active', p.id==='attack-'+tab);
  });
}

function simulateSlandering() {
  const target = STATE.users.find(u=>u.id===document.getElementById('slander-target').value);
  const count = parseInt(document.getElementById('slander-count').value);
  const fbValue = parseInt(document.getElementById('slander-fb').value)/100;
  if(!target) return;

  // Feedback credibility procedure: compare with SP's value Â±0.1
  const spValue = target.trust;
  const range = [spValue-0.1, spValue+0.1];
  const detected = fbValue < range[0] || fbValue > range[1];
  const maliciousDetected = count;

  if(detected) STATE.attackStats.slander++;
  updateAttackStats();

  // Aggregation procedure: collect feedback from many recommenders, penalize bad ones
  const feedbackItems = Array.from({length:count+3},(_,i) => ({
    sp: `SP${i+1}`, value: i < count ? fbValue : spValue + (Math.random()*0.1-0.05), malicious: i < count
  }));

  const blocked = feedbackItems.filter(f=>{
    const diff = Math.abs(f.value - spValue);
    return diff > 0.1;
  });

  document.getElementById('slander-result').innerHTML = `
    <div class="${detected?'alert alert-danger':'alert alert-success'}" style="margin-bottom:14px">
      ${detected ? `âš ï¸ SLANDERING ATTACK DETECTED â€” ${count} malicious recommenders identified` : 'âœ… No attack detected'}
    </div>
    <div class="metric-row"><span class="metric-name">Target</span><span class="metric-val">${target.name}</span></div>
    <div class="metric-row"><span class="metric-name">True Trust Score</span><span class="metric-val trust-val ${trustClass(target.trust)}">${fmt(target.trust)}</span></div>
    <div class="metric-row"><span class="metric-name">Malicious Feedback</span><span class="metric-val trust-low">${fbValue.toFixed(2)}</span></div>
    <div class="metric-row"><span class="metric-name">Valid Range (FVR)</span><span class="metric-val">[${range[0].toFixed(2)}, ${range[1].toFixed(2)}]</span></div>
    <div class="metric-row"><span class="metric-name">Feedback Blocked</span><span class="metric-val trust-high">${blocked.length} / ${feedbackItems.length}</span></div>
    <div class="metric-row"><span class="metric-name">Malicious Recommenders Penalized</span><span class="metric-val trust-warn">${maliciousDetected}</span></div>
    <div class="alert alert-info" style="margin-top:12px;font-size:12px">
      Defense: Feedback Credibility Procedure â€” recommenders with feedback outside Â±0.1 range receive Î² value (negative).
      Aggregation Procedure â€” penalty applied for no-recommendation too.
    </div>`;

  addAuditLog('ATTACK', `SLANDERING ATTACK ${detected?'DETECTED & BLOCKED':'simulation'}. Target: ${target.name}. ${blocked.length} malicious feedbacks rejected.`, 'danger');
  notify(detected?`Slandering attack blocked for ${target.name}`:'No attack detected', detected?'error':'success');
}

function simulateSybil() {
  const attacker = STATE.users.find(u=>u.id===document.getElementById('sybil-attacker').value);
  const fakeCount = parseInt(document.getElementById('sybil-count').value);
  const rl = parseInt(document.getElementById('sybil-rl').value);

  // Mid = Î£ Q(CAn)/Rid
  const mid = fakeCount; // appearance count
  const detected = mid >= rl;
  if(detected) STATE.attackStats.sybil++;
  updateAttackStats();

  const cred = { PI:'attacker@domain.com', CA_email:'x@y.com', CA_ip:'192.168.1.', CA_device:'Chrome/Linux' };

  document.getElementById('sybil-result').innerHTML = `
    <div class="${detected?'alert alert-danger':'alert alert-success'}" style="margin-bottom:14px">
      ${detected ? `âš ï¸ SYBIL ATTACK DETECTED â€” Mid (${mid}) â‰¥ RL (${rl})` : `âœ… Within allowed limit â€” Mid (${mid}) < RL (${rl})`}
    </div>
    <div class="metric-row"><span class="metric-name">Attacker</span><span class="metric-val">${attacker?.name||'Unknown'}</span></div>
    <div class="metric-row"><span class="metric-name">Fake Identities Created</span><span class="metric-val trust-low">${fakeCount}</span></div>
    <div class="metric-row"><span class="metric-name">Max Allowed (RL)</span><span class="metric-val">${rl}</span></div>
    <div class="metric-row"><span class="metric-name">Multi-Identity Detection (Mid)</span><span class="metric-val trust-val ${detected?'trust-low':'trust-high'}">${mid}</span></div>
    <div class="metric-row"><span class="metric-name">RT Frozen?</span><span class="metric-val">${detected?'<span class="badge badge-red">YES â€” RT(last) = RT(first)</span>':'<span class="badge badge-green">NO</span>'}</span></div>
    <div class="metric-row"><span class="metric-name">Credential Match</span><span class="metric-val" style="font-size:11px">${cred.CA_email} / ${cred.CA_ip}xxx</span></div>
    <div class="alert alert-info" style="margin-top:12px;font-size:12px">
      Defense: Trust Identity Registry â€” credential attributes (CA) matched across identities.
      Identity curve limits prevent rapid new identity generation.
    </div>`;

  addAuditLog('ATTACK', `SYBIL ATTACK ${detected?'DETECTED':'simulation'}. Attacker: ${attacker?.name}. ${fakeCount} fake identities. Mid=${mid}`, detected?'danger':'warn');
  notify(detected?`Sybil attack detected for ${attacker?.name}`:'Within limits', detected?'error':'warn');
}

function simulateCollusion() {
  const target = STATE.users.find(u=>u.id===document.getElementById('collusion-target').value);
  const groupSize = parseInt(document.getElementById('collusion-size').value);
  const tc = parseInt(document.getElementById('tc-slider').value)/100;
  const vc = parseInt(document.getElementById('vc-slider').value)/100;
  const fl = parseInt(document.getElementById('fl-val').value)/100;

  // Generate feedback set
  const feedbacks = Array.from({length:groupSize+3},(_,i)=>({
    sp:`SR${i+1}`, value:0.5+Math.random()*0.4, time:Date.now()-i*1000*60*30, malicious:i<groupSize
  }));

  const lastFb = feedbacks[0];
  const tr = lastFb.time * tc;
  const maxVR = lastFb.value * vc;
  const minVR = -lastFb.value * vc;

  // Move to suspected set (SS)
  const ss = feedbacks.filter(f=>{
    if(f===lastFb) return false;
    const timeDiff = Math.abs(lastFb.time - f.time);
    const valDiff = lastFb.value - f.value;
    return timeDiff <= tr && ((valDiff >= 0 && valDiff <= maxVR) || (valDiff < 0 && valDiff >= minVR));
  });

  // CAF per recommender
  const srCafs = {};
  ss.forEach(f=>{ srCafs[f.sp]=(srCafs[f.sp]||0)+1; });
  const cs = Object.entries(srCafs)
    .map(([sp,cnt])=>({ sp, caf:cnt/Math.max(ss.length,1), inCS: cnt/Math.max(ss.length,1) >= fl }))
    .filter(r=>r.inCS);

  const rn_cs = cs.length;
  const fn_cs = cs.reduce((s,r)=>s+srCafs[r.sp],0);
  const as_cr = fn_cs > 0 ? 1 - rn_cs/fn_cs : 0;
  const ats = fn_cs > 0 ? fn_cs/feedbacks.length : 0;
  const cas = ats;
  const detected = cs.length > 0;

  if(detected) STATE.attackStats.collusion++;
  updateAttackStats();

  document.getElementById('collusion-result').innerHTML = `
    <div class="${detected?'alert alert-danger':'alert alert-success'}" style="margin-bottom:14px">
      ${detected ? `âš ï¸ COLLUSION ATTACK DETECTED â€” ${cs.length} colluders identified` : 'âœ… No collusion detected'}
    </div>
    <div class="metric-row"><span class="metric-name">Target</span><span class="metric-val">${target?.name}</span></div>
    <div class="metric-row"><span class="metric-name">Feedback Set (FS)</span><span class="metric-val">${feedbacks.length} items</span></div>
    <div class="metric-row"><span class="metric-name">Suspected Set (SS)</span><span class="metric-val trust-warn">${ss.length} items</span></div>
    <div class="metric-row"><span class="metric-name">Collusion Set (CS)</span><span class="metric-val trust-low">${cs.length} recommenders</span></div>
    <div class="metric-row"><span class="metric-name">Attack Scale (AS)</span><span class="metric-val" style="font-family:'IBM Plex Mono',monospace">${as_cr.toFixed(3)}</span></div>
    <div class="metric-row"><span class="metric-name">Attack Target Scale (ATS)</span><span class="metric-val" style="font-family:'IBM Plex Mono',monospace">${ats.toFixed(3)}</span></div>
    <div class="metric-row"><span class="metric-name">Collusion Attack Strength (CAS)</span><span class="metric-val trust-val ${cas>0.3?'trust-low':cas>0.1?'trust-med':'trust-high'}">${cas.toFixed(3)}</span></div>
    <div class="metric-row"><span class="metric-name">Feedback Limit (FL)</span><span class="metric-val">${(fl*100).toFixed(0)}%</span></div>
    ${detected ? `<div class="alert alert-warn" style="margin-top:12px;font-size:12px">Colluding recommenders: ${cs.map(r=>r.sp).join(', ')} â€” moved to Collusion Set and excluded from trust calculation.</div>` : ''}`;

  addAuditLog('ATTACK', `COLLUSION ${detected?'DETECTED':'simulation'}. Target: ${target?.name}. CS=${cs.length}. CAS=${cas.toFixed(3)}`, detected?'danger':'warn');
  notify(detected?'Collusion attack detected & blocked':'No collusion found', detected?'error':'success');
}

// ============================================================
// CLOUD STORAGE
// ============================================================

function renderCloudPage() {
  populateUserSelect('cloud-owner');
  renderCloudObjects();
}

function renderCloudObjects() {
  const el = document.getElementById('cloud-objects');
  if(!el) return;
  el.innerHTML = STATE.cloudObjects.map(obj => `
    <div style="padding:12px;border:1px solid var(--border);border-radius:8px;margin-bottom:10px;background:var(--surface2)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-weight:600;font-size:13px">${obj.name}</div>
          <div style="font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace">${obj.id}</div>
        </div>
        <div style="display:flex;gap:6px">
          ${sensitivityBadge(obj.sensitivity)}
          ${obj.encrypted?'<span class="badge badge-green">ðŸ” AES-256</span>':'<span class="badge badge-red">UNENCRYPTED</span>'}
        </div>
      </div>
      <div style="display:flex;gap:16px;font-size:11px;color:var(--text2)">
        <span>ðŸ‘¤ ${obj.owner}</span>
        <span>ðŸ’¾ ${obj.size}</span>
        <span>ðŸ“‹ ${obj.accessCount} accesses</span>
        <span>ðŸ”‘ Threshold: <strong class="trust-val ${trustClass(obj.threshold)}">${obj.threshold}</strong></span>
      </div>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
        ${obj.roles.map(r=>`<span class="badge badge-blue">${r}</span>`).join('')}
      </div>
    </div>`).join('');
}

function uploadCloudData() {
  const ownerId = document.getElementById('cloud-owner').value;
  const name = document.getElementById('cloud-res-name').value.trim();
  const sensitivity = document.getElementById('cloud-sensitivity').value;
  const threshold = parseFloat(document.getElementById('cloud-threshold').value);
  const rolesEl = document.getElementById('cloud-allowed-roles');
  const roles = Array.from(rolesEl.selectedOptions).map(o=>o.value);

  if(!name) { notify('Resource name required','error'); return; }
  const owner = STATE.users.find(u=>u.id===ownerId);

  const id = 'OBJ' + String(STATE.cloudObjects.length+1).padStart(3,'0');
  STATE.cloudObjects.push({ id, name, owner:owner?.name||'Unknown', sensitivity, size:'~10 MB', encrypted:true, roles, threshold, accessCount:0 });

  renderCloudObjects();
  notify(`${name} encrypted and uploaded`, 'success');
  addAuditLog('UPLOAD', `Data uploaded: ${name} by ${owner?.name}. Sensitivity:${sensitivity}. Threshold:${threshold}. Roles:${roles.join(',')}`, 'success');

  const logEl = document.getElementById('cloud-log');
  if(logEl) {
    const lines = [
      `[${now()}] Generating AES-256 encryption key...`,
      `[${now()}] Encrypting data object: ${name}`,
      `[${now()}] Applying T-RBAC policy: threshold=${threshold}, roles=[${roles.join(',')}]`,
      `[${now()}] Uploading to cloud storage: ${id}`,
      `[${now()}] âœ… Upload complete. Data owner: ${owner?.name}`,
    ];
    logEl.innerHTML += lines.map(l=>`<div class="log-line"><span class="log-type-success">${l}</span></div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }

  document.getElementById('cloud-res-name').value='';
}

// ============================================================
// AUDIT LOG
// ============================================================

function refreshAuditLog() {
  const el = document.getElementById('audit-log');
  if(!el) return;
  const filter = document.getElementById('log-filter')?.value||'';
  const filtered = filter ? STATE.auditLog.filter(l=>l.type===filter) : STATE.auditLog;
  const colorMap = { success:'log-type-success', warn:'log-type-warn', danger:'log-type-danger', info:'log-type-info' };
  el.innerHTML = filtered.slice(0,100).map(l=>
    `<div class="log-line"><span class="log-time">[${l.time}]</span><span class="badge badge-${l.level==='success'?'green':l.level==='danger'?'red':l.level==='warn'?'yellow':'blue'}" style="font-size:9px;margin-right:4px">${l.type}</span><span class="${colorMap[l.level]||'log-msg'}">${l.msg}</span></div>`
  ).join('');
  el.scrollTop = 0;
}

function filterLogs() { refreshAuditLog(); }
function clearLogs() { STATE.auditLog=[]; refreshAuditLog(); notify('Audit log cleared','info'); }

// ============================================================
// CLOCK
// ============================================================

function updateClock() {
  document.getElementById('headerTime').textContent = new Date().toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

// ============================================================
// INIT
// ============================================================

// Pre-populate audit log
const initLogs = [
  ['ACCESS','GRANTED: Leo Garcia â†’ Patient Records [READ] (trust:0.95 threshold:0.75)','success'],
  ['TRUST','Trust evaluation completed for 12 users via T-RBAC model','info'],
  ['ATTACK','SYBIL ATTACK DETECTED â€” fake identities blocked via Mid algorithm','danger'],
  ['UPLOAD','Data uploaded: Patient_Records_2024 by Alice Chen. AES-256 encrypted.','success'],
  ['ACCESS','DENIED: Henry Davis â†’ Admin Config [WRITE] (trust:0.39 threshold:0.85)','danger'],
  ['TRUST','Recommendation trust computed for User5 via 4 service providers','info'],
];
initLogs.forEach(([type,msg,level])=>{
  STATE.auditLog.push({ time:now(), type, msg, level });
});

// Initial render
renderDashboard();
