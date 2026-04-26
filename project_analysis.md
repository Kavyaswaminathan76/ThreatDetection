# Project Analysis: T-RBAC Trust Evaluation System for Cloud Security

## 📌 Project Concept

This is a **final year project** focused on **securing cloud services from reputation attacks** using a **Trust-based Role-Based Access Control (T-RBAC)** model. The system combines:

1. **Trust Evaluation** — dynamically computing trust scores for cloud consumers based on interactions and recommendations
2. **Access Control** — granting/denying access to cloud resources based on trust thresholds (not just static roles)
3. **Attack Detection** — identifying and mitigating reputation attacks (slandering, Sybil/multi-identity, collusion)
4. **Machine Learning-based Threat Detection** — using ML models (Random Forest, Isolation Forest) to detect anomalous/malicious behavior from cloud logs

> [!IMPORTANT]
> The core idea is that traditional RBAC assigns permissions based on roles alone, which is vulnerable to insider threats and reputation manipulation. T-RBAC adds a **trust layer** where users must maintain a minimum trust score to retain access — even if they hold the right role.

---

## 🛠️ Languages & Technologies Used

| Language / Technology | Usage | Files |
|---|---|---|
| **HTML** | Frontend UI — the main web dashboard (single-page app) | `index.html` (2,338 lines) |
| **CSS** (vanilla) | Styling with dark theme, glassmorphism, animations, CSS variables | Embedded in `index.html` `<style>` block |
| **JavaScript** (vanilla) | All frontend logic — trust calculations, attack simulations, navigation, data model, DOM rendering | Embedded in `index.html` `<script>` block |
| **Python** | Backend ML pipeline — log ingestion, feature engineering, model training, alert serving | 4 scripts in `cloud-threat-detection/src/` |

### Python Libraries Used (from `requirements.txt`)

| Library | Purpose |
|---|---|
| `pandas` | Dataframes and CSV handling |
| `numpy` | Numerical operations (entropy calculation, arrays) |
| `scikit-learn` | ML algorithms — RandomForestClassifier, IsolationForest, train/test split |
| `joblib` | Saving/loading trained ML models |
| `flask` | Web/API interface (optional, for serving alerts) |
| `matplotlib` | Visualization and plotting metrics |

---

## 🏗️ Project Architecture

### Part 1: Frontend Web Dashboard (`index.html`)

A fully self-contained, single-page application with **9 main modules**:

| Module | Description |
|---|---|
| **Dashboard** | Real-time stats — total users, trust rate, pending requests, attacks blocked, trust distribution charts |
| **Architecture** | Visual diagram of the T-RBAC system flow (Data Owner → TMS → T-RBAC Layer → Cloud → Consumer) |
| **Users & Roles** | CRUD management of cloud consumers with roles (Admin, Doctor, Analyst, Finance, Auditor, Viewer) |
| **Tasks & Permissions** | Define tasks with trust thresholds; permissions are assigned to tasks (not roles directly) |
| **Access Requests** | Simulate and evaluate real-time cloud data access requests against trust scores |
| **Trust Calculator** | Compute **Interaction Trust (IT)** and **Recommendation Trust (RT)** using mathematical formulas, with trust decay and conditional transfer simulations |
| **Recommendations** | Submit/validate service provider feedback with credibility checking (±0.1 range) |
| **Attack Detection** | Simulate and detect 3 types of attacks: Slandering/Ballot-Stuffing, Sybil/Multi-Identity, and Collusion (CAF/CAS/ATS analysis) |
| **Cloud Storage** | Encrypted data management with per-role key distribution and AES-256 simulation |
| **Audit Logs** | Complete audit trail of all trust evaluations, access decisions, and security events |

### Part 2: ML Backend Pipeline (`cloud-threat-detection/`)

```
cloud-threat-detection/
├── data/
│   ├── raw/           # Raw CSV/TXT log files (input)
│   └── cleaned/       # Cleaned/normalized data (output)
├── src/
│   ├── ingest/
│   │   └── parse_logs.py        # Step 1: Ingest & clean raw logs
│   ├── features/
│   │   └── build_features.py    # Step 2: Feature engineering
│   ├── models/
│   │   └── train_baseline.py    # Step 3: Train ML models
│   └── serve/
│       └── alert_cli.py         # Step 4: Generate alerts
├── models/            # Saved trained models (.pkl)
├── outputs/           # Analysis outputs
└── requirements.txt   # Python dependencies
```

#### ML Pipeline Flow:

1. **`parse_logs.py`** — Ingests raw CSV/TXT network logs, auto-detects label columns (benign vs attack), normalizes labels, removes duplicates
2. **`build_features.py`** — Engineers per-entity features: total flows, bytes, unique destinations, unique ports, protocol entropy; splits into train/test
3. **`train_baseline.py`** — Trains either:
   - **Supervised** (RandomForestClassifier) if labels exist → classification report + feature importances
   - **Unsupervised** (IsolationForest) if no labels → anomaly scores
4. **`alert_cli.py`** — Loads trained model and outputs top predicted attack entities or top anomalies

---

## 🔐 Key Concepts Implemented

### Trust Model (5 Trust Types)
| Type | Description |
|---|---|
| Type 1 | Owners' trust in recommenders |
| Type 2 | Owners' trust in task functionality |
| Type 3 | Owners' trust in role functionality |
| Type 4 | Roles' trust in user functionality |
| Type 5 | Tasks' trust in user functionality |

### Trust Formulas
- **Interaction Trust (IT)**: `IT(R) = Σ (α + PR) / ((α + PR) + (β + NR))` where α = positive feedback, β = negative feedback, PR/NR = positive/negative ratings
- **Recommendation Trust (RT)**: Aggregated from multiple service providers with exchange transaction weight (WEX) and time weight (WL)
- **Trust Decay**: Trust scores decrease over time without positive interactions
- **Conditional Trust Transfer**: Trust propagates through the role hierarchy

### Attack Detection Mechanisms
- **Slandering / Ballot-Stuffing**: Detects groups submitting maliciously low/high feedback
- **Sybil (Multi-Identity)**: Detects when a single attacker creates multiple fake identities (Mid detection with RL limit)
- **Collusion**: Uses CAF (Collusion Attack Factor), CAS, and ATS analysis to detect coordinated attack groups based on time-range (TC) and value-range (VC) proximity

---

## 📄 Reference Papers (included in project)

1. *Building a Comprehensive Trust Evaluation Model to Secure Cloud Services From Reputation Attacks*
2. *Cybersecurity in Cloud Computing: AI-Driven Intrusion Detection and Mitigation Strategies*
3. *Green Video Transcoding in Cloud Environments Using Kubernetes*
4. *Literature Review of Machine Learning and Threat Intelligence in Cloud Security*

---

## Summary

| Aspect | Details |
|---|---|
| **Domain** | Cloud Security / Cybersecurity |
| **Approach** | Trust-based Access Control + Machine Learning |
| **Languages** | HTML, CSS, JavaScript, Python |
| **ML Models** | Random Forest (supervised), Isolation Forest (unsupervised) |
| **Frontend** | Single-page dark-themed dashboard (2,300+ lines) |
| **Backend** | 4-stage Python ML pipeline |
| **Key Innovation** | Combining T-RBAC trust evaluation with reputation attack detection and ML-based threat analysis |
