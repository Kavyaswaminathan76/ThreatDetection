# server/app.py
"""
T-RBAC Flask REST API Server
Run: python server/app.py
Base URL: http://localhost:5000
"""
import os, sys, json
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(__file__))
from database import init_db, get_conn, rows_to_list, row_to_dict
import ml_api

# ── App setup ──────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ── Helpers ────────────────────────────────────────────────────

def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def add_audit(conn, log_type, msg, level="info"):
    conn.execute(
        "INSERT INTO audit_logs (timestamp,type,msg,level) VALUES (?,?,?,?)",
        (now_str(), log_type, msg, level))

def ok(data=None, **kwargs):
    body = {"success": True}
    if data is not None:
        body["data"] = data
    body.update(kwargs)
    return jsonify(body)

def err(msg, code=400):
    return jsonify({"success": False, "error": msg}), code

# ── Serve frontend ─────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

# ══════════════════════════════════════════════════════════════
# USERS
# ══════════════════════════════════════════════════════════════

@app.route('/api/users', methods=['GET'])
def get_users():
    conn = get_conn()
    users = rows_to_list(conn.execute("SELECT * FROM users").fetchall())
    conn.close()
    return ok(users)

@app.route('/api/users', methods=['POST'])
def add_user():
    d = request.get_json()
    required = ['name', 'email', 'role', 'trust']
    if not all(k in d for k in required):
        return err("Missing fields: " + ", ".join(required))

    role_task_map = {'Admin':'T1','Doctor':'T2','Analyst':'T3',
                     'Finance':'T4','Auditor':'T5','Viewer':'T6'}
    conn = get_conn()
    # Generate next ID
    count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    uid = f"U{count + 1}"
    task_id = role_task_map.get(d['role'], 'T6')
    conn.execute(
        "INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?)",
        (uid, d['name'], d['email'], d['role'], task_id,
         float(d['trust']), 0, 'active', 'just now'))
    add_audit(conn, 'USER', f"New user added: {d['name']} ({d['role']}) trust={d['trust']}", 'success')
    conn.commit()
    user = row_to_dict(conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())
    conn.close()
    return ok(user), 201

@app.route('/api/users/<uid>', methods=['PUT'])
def update_user(uid):
    d = request.get_json()
    conn = get_conn()
    user = row_to_dict(conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())
    if not user:
        conn.close()
        return err("User not found", 404)

    # Build dynamic SET clause
    allowed = {'trust', 'status', 'interactions', 'last_seen', 'role', 'task_id'}
    updates = {k: v for k, v in d.items() if k in allowed}
    if not updates:
        conn.close()
        return err("No valid fields to update")

    set_clause = ", ".join(f"{k}=?" for k in updates)
    vals = list(updates.values()) + [uid]
    conn.execute(f"UPDATE users SET {set_clause} WHERE id=?", vals)

    if 'trust' in updates:
        add_audit(conn, 'TRUST',
                  f"Trust update: {user['name']} → {updates['trust']}", 'success')
    if 'status' in updates:
        add_audit(conn, 'USER',
                  f"User {user['name']} status → {updates['status']}",
                  'success' if updates['status'] == 'active' else 'warn')

    conn.commit()
    updated = row_to_dict(conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())
    conn.close()
    return ok(updated)

@app.route('/api/users/<uid>', methods=['DELETE'])
def delete_user(uid):
    conn = get_conn()
    user = row_to_dict(conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())
    if not user:
        conn.close()
        return err("User not found", 404)
    conn.execute("DELETE FROM users WHERE id=?", (uid,))
    add_audit(conn, 'USER', f"User deleted: {user['name']}", 'warn')
    conn.commit()
    conn.close()
    return ok({"deleted": uid})

# ══════════════════════════════════════════════════════════════
# TASKS
# ══════════════════════════════════════════════════════════════

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    conn = get_conn()
    tasks = rows_to_list(conn.execute("SELECT * FROM tasks").fetchall())
    conn.close()
    return ok(tasks)

@app.route('/api/tasks', methods=['POST'])
def add_task():
    d = request.get_json()
    required = ['name', 'role', 'permission', 'threshold', 'sensitivity']
    if not all(k in d for k in required):
        return err("Missing fields")
    conn = get_conn()
    count = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
    tid = f"T{count + 1}"
    conn.execute(
        "INSERT INTO tasks VALUES (?,?,?,?,?,?,?)",
        (tid, d['name'], d['role'], d['permission'],
         float(d['threshold']), d['sensitivity'], 1))
    add_audit(conn, 'TASK', f"Task created: {d['name']} ({d['role']}, {d['permission']})", 'success')
    conn.commit()
    task = row_to_dict(conn.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone())
    conn.close()
    return ok(task), 201

# ══════════════════════════════════════════════════════════════
# ROLES
# ══════════════════════════════════════════════════════════════

@app.route('/api/roles', methods=['GET'])
def get_roles():
    conn = get_conn()
    roles = rows_to_list(conn.execute("SELECT * FROM roles").fetchall())
    conn.close()
    for r in roles:
        r['inherits'] = json.loads(r.get('inherits', '[]'))
    return ok(roles)

# ══════════════════════════════════════════════════════════════
# ACCESS EVALUATION
# ══════════════════════════════════════════════════════════════

@app.route('/api/access/evaluate', methods=['POST'])
def evaluate_access():
    d = request.get_json()
    uid = d.get('user_id')
    resource = d.get('resource', 'Unknown Resource')
    operation = d.get('operation', 'READ').upper()

    conn = get_conn()
    user = row_to_dict(conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())
    if not user:
        conn.close()
        return err("User not found", 404)

    # Find best matching task
    task = row_to_dict(conn.execute(
        "SELECT * FROM tasks WHERE role=? AND permission=?",
        (user['role'], operation)).fetchone())
    if not task:
        task = row_to_dict(conn.execute(
            "SELECT * FROM tasks WHERE role=?", (user['role'],)).fetchone())

    role = row_to_dict(conn.execute(
        "SELECT * FROM roles WHERE name=?", (user['role'],)).fetchone())

    threshold = task['threshold'] if task else (role['threshold'] if role else 0.5)
    granted = user['status'] == 'active' and user['trust'] >= threshold

    # Log
    conn.execute(
        """INSERT INTO access_history
           (timestamp,user_name,resource,operation,trust,threshold,granted,task_name)
           VALUES (?,?,?,?,?,?,?,?)""",
        (now_str(), user['name'], resource, operation,
         user['trust'], threshold, int(granted), task['name'] if task else 'N/A'))

    # Update interactions
    if granted:
        conn.execute(
            "UPDATE users SET interactions=interactions+1, last_seen=? WHERE id=?",
            (now_str(), uid))

    level = 'success' if granted else 'danger'
    add_audit(conn, 'ACCESS',
              f"{'GRANTED' if granted else 'DENIED'}: {user['name']} → {resource} "
              f"[{operation}] (trust:{user['trust']:.2f} threshold:{threshold:.2f})", level)
    conn.commit()

    result = {
        "granted": granted,
        "user": user,
        "task": task,
        "threshold": threshold,
        "resource": resource,
        "operation": operation,
    }
    conn.close()
    return ok(result)

@app.route('/api/access/history', methods=['GET'])
def get_access_history():
    limit = int(request.args.get('limit', 50))
    conn = get_conn()
    rows = rows_to_list(conn.execute(
        "SELECT * FROM access_history ORDER BY id DESC LIMIT ?", (limit,)).fetchall())
    conn.close()
    return ok(rows)

# ══════════════════════════════════════════════════════════════
# TRUST — RECOMMENDATIONS
# ══════════════════════════════════════════════════════════════

@app.route('/api/recommendations', methods=['POST'])
def submit_recommendation():
    d = request.get_json()
    sp_id       = d.get('sp_id')
    consumer_id = d.get('consumer_id')
    feedback    = int(d.get('feedback', 50))
    ii          = float(d.get('ii', 0.7))

    conn = get_conn()
    sp       = row_to_dict(conn.execute("SELECT * FROM users WHERE id=?", (sp_id,)).fetchone())
    consumer = row_to_dict(conn.execute("SELECT * FROM users WHERE id=?", (consumer_id,)).fetchone())

    if not sp or not consumer or sp_id == consumer_id:
        conn.close()
        return err("Invalid SP or consumer selection")

    fb_norm  = feedback / 100.0
    sp_trust = consumer['trust']
    credible = abs(fb_norm - sp_trust) <= 0.1

    conn.execute(
        """INSERT INTO recommendations
           (timestamp,sp_name,consumer_name,feedback,fb_norm,ii,credible)
           VALUES (?,?,?,?,?,?,?)""",
        (now_str(), sp['name'], consumer['name'], feedback, fb_norm, ii, int(credible)))

    if credible:
        delta = (fb_norm - consumer['trust']) * 0.1 * ii
        new_trust = round(max(0, min(1, consumer['trust'] + delta)), 4)
        conn.execute("UPDATE users SET trust=?, interactions=interactions+1 WHERE id=?",
                     (new_trust, consumer_id))
        add_audit(conn, 'TRUST',
                  f"Feedback {sp['name']}→{consumer['name']}: {feedback}/100 (credible) trust={new_trust}", 'success')
    else:
        add_audit(conn, 'TRUST',
                  f"Feedback {sp['name']}→{consumer['name']}: {feedback}/100 REJECTED (outside ±0.1)", 'warn')

    conn.commit()
    conn.close()
    return ok({"credible": credible, "feedback": feedback, "fb_norm": fb_norm})

@app.route('/api/recommendations', methods=['GET'])
def get_recommendations():
    limit = int(request.args.get('limit', 50))
    conn = get_conn()
    rows = rows_to_list(conn.execute(
        "SELECT * FROM recommendations ORDER BY id DESC LIMIT ?", (limit,)).fetchall())
    conn.close()
    return ok(rows)

# ══════════════════════════════════════════════════════════════
# AUDIT LOG
# ══════════════════════════════════════════════════════════════

@app.route('/api/audit', methods=['GET'])
def get_audit():
    limit  = int(request.args.get('limit', 100))
    filter_type = request.args.get('type', '')
    conn = get_conn()
    if filter_type:
        rows = rows_to_list(conn.execute(
            "SELECT * FROM audit_logs WHERE type=? ORDER BY id DESC LIMIT ?",
            (filter_type, limit)).fetchall())
    else:
        rows = rows_to_list(conn.execute(
            "SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", (limit,)).fetchall())
    conn.close()
    return ok(rows)

@app.route('/api/audit', methods=['DELETE'])
def clear_audit():
    conn = get_conn()
    conn.execute("DELETE FROM audit_logs")
    conn.commit()
    conn.close()
    return ok({"cleared": True})

# ══════════════════════════════════════════════════════════════
# CLOUD STORAGE
# ══════════════════════════════════════════════════════════════

@app.route('/api/cloud/objects', methods=['GET'])
def get_cloud_objects():
    conn = get_conn()
    rows = rows_to_list(conn.execute("SELECT * FROM cloud_objects").fetchall())
    conn.close()
    for r in rows:
        r['roles'] = json.loads(r.get('roles_json', '[]'))
        r['encrypted'] = bool(r['encrypted'])
    return ok(rows)

@app.route('/api/cloud/upload', methods=['POST'])
def upload_cloud_object():
    d = request.get_json()
    required = ['name', 'owner', 'sensitivity', 'threshold', 'roles']
    if not all(k in d for k in required):
        return err("Missing fields")

    conn = get_conn()
    count = conn.execute("SELECT COUNT(*) FROM cloud_objects").fetchone()[0]
    oid = f"OBJ{str(count + 1).zfill(3)}"
    roles_json = json.dumps(d['roles'])
    conn.execute(
        "INSERT INTO cloud_objects VALUES (?,?,?,?,?,?,?,?,?)",
        (oid, d['name'], d['owner'], d['sensitivity'],
         d.get('size', '~10 MB'), 1, roles_json,
         float(d['threshold']), 0))
    add_audit(conn, 'UPLOAD',
              f"Data uploaded: {d['name']} by {d['owner']}. Sensitivity:{d['sensitivity']}. AES-256 encrypted.", 'success')
    conn.commit()
    obj = row_to_dict(conn.execute("SELECT * FROM cloud_objects WHERE id=?", (oid,)).fetchone())
    conn.close()
    obj['roles'] = json.loads(obj.get('roles_json', '[]'))
    obj['encrypted'] = True
    return ok(obj), 201

# ══════════════════════════════════════════════════════════════
# ATTACK STATS
# ══════════════════════════════════════════════════════════════

@app.route('/api/attacks/stats', methods=['GET'])
def get_attack_stats():
    conn = get_conn()
    row = row_to_dict(conn.execute("SELECT * FROM attack_stats WHERE id=1").fetchone())
    conn.close()
    return ok(row)

@app.route('/api/attacks/simulate', methods=['POST'])
def log_attack():
    d = request.get_json()
    attack_type = d.get('type', 'slander')  # slander|sybil|collusion|self
    detected    = d.get('detected', False)

    col_map = {'slander':'slander','sybil':'sybil',
               'collusion':'collusion','self':'self_promote'}
    col = col_map.get(attack_type, 'slander')

    conn = get_conn()
    if detected:
        conn.execute(f"UPDATE attack_stats SET {col}={col}+1 WHERE id=1")
    add_audit(conn, 'ATTACK',
              f"{attack_type.upper()} ATTACK {'DETECTED & BLOCKED' if detected else 'simulated'}. {d.get('detail','')}",
              'danger' if detected else 'warn')
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM attack_stats WHERE id=1").fetchone())
    conn.close()
    return ok(row)

# ══════════════════════════════════════════════════════════════
# ML MODEL
# ══════════════════════════════════════════════════════════════

@app.route('/api/ml/info', methods=['GET'])
def ml_info():
    info = ml_api.get_model_info()
    conn = get_conn()
    history = rows_to_list(conn.execute(
        "SELECT * FROM ml_model_info ORDER BY id DESC LIMIT 5").fetchall())
    conn.close()
    info['training_history'] = history
    return ok(info)

@app.route('/api/ml/predict', methods=['POST'])
def ml_predict():
    body = request.get_json()
    if not body:
        return err("Send flow features as JSON body")
    model_type = body.pop('model_type', 'rf')   # 'rf' or 'dt'
    result = ml_api.predict(body, model_type=model_type)
    if 'error' in result:
        return err(result['error'])
    return ok(result)

@app.route('/api/ml/compare', methods=['POST'])
def ml_compare():
    """Run both RF and DT on the same input and return side-by-side results."""
    features = request.get_json()
    if not features:
        return err("Send flow features as JSON body")
    rf_result = ml_api.predict(dict(features), model_type='rf')
    dt_result = ml_api.predict(dict(features), model_type='dt')
    return ok({"random_forest": rf_result, "decision_tree": dt_result})

@app.route('/api/ml/retrain', methods=['POST'])
def ml_retrain():
    result = ml_api.retrain_model_async(get_conn)
    return ok(result)

@app.route('/api/ml/retrain/status', methods=['GET'])
def ml_retrain_status():
    return ok(ml_api.get_retrain_status())

# ══════════════════════════════════════════════════════════════
# STARTUP
# ══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("=" * 55)
    print("  T-RBAC Flask API Server")
    print("=" * 55)
    init_db()
    ml_api.load_model()
    print("[Server] Starting at http://localhost:5000")
    print("[Server] Frontend at http://localhost:5000/")
    print("=" * 55)
    app.run(debug=True, port=5000, use_reloader=False)
