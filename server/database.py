# server/database.py
import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'trbac.db')

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    task_id TEXT NOT NULL,
    trust REAL NOT NULL DEFAULT 0.5,
    interactions INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    last_seen TEXT DEFAULT 'just now'
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    permission TEXT NOT NULL,
    threshold REAL NOT NULL DEFAULT 0.5,
    sensitivity TEXT NOT NULL DEFAULT 'medium',
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS roles (
    name TEXT PRIMARY KEY,
    level INTEGER NOT NULL,
    threshold REAL NOT NULL,
    inherits TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS access_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    user_name TEXT NOT NULL,
    resource TEXT NOT NULL,
    operation TEXT NOT NULL,
    trust REAL NOT NULL,
    threshold REAL NOT NULL,
    granted INTEGER NOT NULL,
    task_name TEXT
);

CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    sp_name TEXT NOT NULL,
    consumer_name TEXT NOT NULL,
    feedback INTEGER NOT NULL,
    fb_norm REAL NOT NULL,
    ii REAL NOT NULL,
    credible INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    type TEXT NOT NULL,
    msg TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'info'
);

CREATE TABLE IF NOT EXISTS cloud_objects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    sensitivity TEXT NOT NULL DEFAULT 'medium',
    size TEXT DEFAULT '~10 MB',
    encrypted INTEGER NOT NULL DEFAULT 1,
    roles_json TEXT NOT NULL DEFAULT '[]',
    threshold REAL NOT NULL DEFAULT 0.5,
    access_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ml_model_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trained_at TEXT NOT NULL,
    accuracy REAL,
    precision_score REAL,
    recall_score REAL,
    f1_score REAL,
    dataset TEXT,
    train_samples INTEGER,
    test_samples INTEGER,
    features INTEGER
);

CREATE TABLE IF NOT EXISTS attack_stats (
    id INTEGER PRIMARY KEY DEFAULT 1,
    slander INTEGER NOT NULL DEFAULT 0,
    self_promote INTEGER NOT NULL DEFAULT 0,
    sybil INTEGER NOT NULL DEFAULT 0,
    collusion INTEGER NOT NULL DEFAULT 0
);
"""

SEED_DATA = {
    "users": [
        ("U1",  "Alice Chen",   "alice@hospital.org",  "Admin",   "T1", 0.92, 45, "active",    "2min ago"),
        ("U2",  "Bob Martinez", "bob@hospital.org",    "Doctor",  "T2", 0.87, 38, "active",    "5min ago"),
        ("U3",  "Carol Singh",  "carol@finance.org",   "Finance", "T4", 0.74, 22, "active",    "12min ago"),
        ("U4",  "David Kim",    "david@gov.org",       "Analyst", "T3", 0.68, 31, "active",    "1hr ago"),
        ("U5",  "Eve Johnson",  "eve@hospital.org",    "Auditor", "T5", 0.55, 15, "active",    "2hr ago"),
        ("U6",  "Frank Lee",    "frank@hospital.org",  "Viewer",  "T6", 0.43,  8, "active",    "1day ago"),
        ("U7",  "Grace Wu",     "grace@finance.org",   "Finance", "T4", 0.81, 27, "active",    "30min ago"),
        ("U8",  "Henry Davis",  "henry@gov.org",       "Analyst", "T3", 0.39,  6, "suspended", "3day ago"),
        ("U9",  "Iris Brown",   "iris@hospital.org",   "Doctor",  "T2", 0.76, 41, "active",    "8min ago"),
        ("U10", "Jack Wilson",  "jack@hospital.org",   "Viewer",  "T6", 0.28,  3, "suspended", "5day ago"),
        ("U11", "Kate Taylor",  "kate@finance.org",    "Auditor", "T5", 0.88, 33, "active",    "15min ago"),
        ("U12", "Leo Garcia",   "leo@gov.org",         "Admin",   "T1", 0.95, 52, "active",    "just now"),
    ],
    "tasks": [
        ("T1", "ManageSystem",    "Admin",   "ADMIN", 0.85, "critical", 1),
        ("T2", "ReadPatientData", "Doctor",  "READ",  0.75, "high",     1),
        ("T3", "AnalyzeData",     "Analyst", "READ",  0.60, "medium",   1),
        ("T4", "ViewFinancials",  "Finance", "READ",  0.70, "high",     1),
        ("T5", "AuditLogs",       "Auditor", "READ",  0.65, "medium",   1),
        ("T6", "ViewDashboard",   "Viewer",  "READ",  0.30, "low",      1),
    ],
    "roles": [
        ("Admin",   5, 0.85, '["Analyst","Viewer"]'),
        ("Doctor",  4, 0.75, '["Viewer"]'),
        ("Finance", 3, 0.70, '["Viewer"]'),
        ("Analyst", 3, 0.60, '["Viewer"]'),
        ("Auditor", 2, 0.65, '["Viewer"]'),
        ("Viewer",  1, 0.30, '[]'),
    ],
    "cloud_objects": [
        ("OBJ001", "Patient_Records_2024",  "Alice Chen",  "critical", "128 MB", 1, '["Admin","Doctor"]',  0.85, 12),
        ("OBJ002", "Financial_Q3_Report",   "Leo Garcia",  "high",     "24 MB",  1, '["Admin","Finance"]', 0.75, 8),
        ("OBJ003", "Gov_Database_Backup",   "Leo Garcia",  "critical", "512 MB", 1, '["Admin"]',           0.90, 3),
        ("OBJ004", "Analytics_Dashboard",   "Alice Chen",  "medium",   "8 MB",   1, '["Admin","Analyst"]', 0.60, 22),
        ("OBJ005", "Audit_Trail_Log",       "Kate Taylor", "high",     "45 MB",  1, '["Admin","Auditor"]', 0.65, 7),
    ],
    "attack_stats": [(1, 0, 0, 0, 0)],
    "audit_logs": [
        ("2024-01-01 09:00:00", "ACCESS", "GRANTED: Leo Garcia → Patient Records [READ] (trust:0.95)", "success"),
        ("2024-01-01 09:01:00", "TRUST",  "Trust evaluation completed for 12 users via T-RBAC model",  "info"),
        ("2024-01-01 09:02:00", "ATTACK", "SYBIL ATTACK DETECTED — fake identities blocked via Mid",   "danger"),
        ("2024-01-01 09:03:00", "UPLOAD", "Data uploaded: Patient_Records_2024. AES-256 encrypted.",   "success"),
        ("2024-01-01 09:04:00", "ACCESS", "DENIED: Henry Davis → Admin Config (trust:0.39 < 0.85)",    "danger"),
    ],
    "ml_model_info": [
        ("2026-05-07 14:30:00", 80.59, 81.25, 80.59, 80.48,
         "CICIDS2017 (Friday DDoS + PortScan)", 348560, 87141, 6),
    ]
}


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_conn()
    conn.executescript(SCHEMA)

    # Seed only if tables are empty
    cur = conn.cursor()

    if not cur.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        conn.executemany(
            "INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?)", SEED_DATA["users"])

    if not cur.execute("SELECT 1 FROM tasks LIMIT 1").fetchone():
        conn.executemany(
            "INSERT INTO tasks VALUES (?,?,?,?,?,?,?)", SEED_DATA["tasks"])

    if not cur.execute("SELECT 1 FROM roles LIMIT 1").fetchone():
        conn.executemany(
            "INSERT INTO roles VALUES (?,?,?,?)", SEED_DATA["roles"])

    if not cur.execute("SELECT 1 FROM cloud_objects LIMIT 1").fetchone():
        conn.executemany(
            "INSERT INTO cloud_objects VALUES (?,?,?,?,?,?,?,?,?)",
            SEED_DATA["cloud_objects"])

    if not cur.execute("SELECT 1 FROM attack_stats LIMIT 1").fetchone():
        conn.execute(
            "INSERT INTO attack_stats VALUES (?,?,?,?,?)",
            SEED_DATA["attack_stats"][0])

    if not cur.execute("SELECT 1 FROM audit_logs LIMIT 1").fetchone():
        conn.executemany(
            "INSERT INTO audit_logs (timestamp,type,msg,level) VALUES (?,?,?,?)",
            SEED_DATA["audit_logs"])

    if not cur.execute("SELECT 1 FROM ml_model_info LIMIT 1").fetchone():
        conn.executemany(
            "INSERT INTO ml_model_info (trained_at,accuracy,precision_score,recall_score,f1_score,dataset,train_samples,test_samples,features) VALUES (?,?,?,?,?,?,?,?,?)",
            SEED_DATA["ml_model_info"])

    conn.commit()
    conn.close()
    print(f"[DB] Initialized → {DB_PATH}")


def row_to_dict(row):
    return dict(row) if row else None


def rows_to_list(rows):
    return [dict(r) for r in rows]
