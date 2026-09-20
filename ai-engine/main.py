from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import torch
import math
import httpx
import asyncio
import os

from redis_client import push_transaction, record_transaction_time, get_recent_transactions
from features import extract_features
from gnn_model import load_or_initialize_model, build_transaction_graph
import json
from explainer import generate_explanation

app = FastAPI(title="FraudShield AI Engine", version="1.0.0")

# Load model globally on startup
model = load_or_initialize_model()

# Setup default threshold, loading dynamically if available
GNN_THRESHOLD = 0.65
try:
    report_path = os.path.join(os.path.dirname(__file__), "training", "results", "evaluation_report.json")
    if os.path.exists(report_path):
        with open(report_path, "r") as f:
            report_data = json.load(f)
            if "recommended_threshold" in report_data:
                GNN_THRESHOLD = report_data["recommended_threshold"]
except Exception as e:
    pass

print(f"[FraudShield] GNN threshold loaded: {GNN_THRESHOLD}")

class TransactionPayload(BaseModel):
    """Incoming transaction data from the Node.js server."""
    amount: float
    senderVpa: str
    receiverVpa: str
    location: str
    timestamp: str
    userId: Optional[str] = None
    receiverRiskScore: Optional[float] = 0.0  # NEW: receiver-side risk intelligence
    mockContext: Optional[dict] = None        # NEW: Phase 12 mock data context

@app.get("/")
def home():
    return {"message": "FraudShield AI Engine is Online", "version": "1.0.0"}

@app.get("/analyze")
def analyze_transaction_get(amount: float):
    """Legacy GET endpoint for backward compatibility."""
    if amount > 100000:
        return {"status": "High Risk", "action": "Freeze", "reason": f"High amount: ₹{amount:,.2f}", "riskScore": 75.0}
    return {"status": "Safe", "action": "Allow", "reason": "Amount within normal range", "riskScore": 10.0}

from typing import List

def blend_scores(
    gnn_score: float,
    mock_risk_score: float,
    anomaly_flags: List[str],
    sender_behavior: dict,
    receiver_validation: dict
) -> float:
    """
    Blend GNN score with mock enrichment.
    Conservative approach: trust GNN more for normal transactions.
    """

    # SAFEGUARD: If GNN says it's normal AND mock says it's normal, keep it normal
    if gnn_score < 0.4 and mock_risk_score < 0.4 and len(anomaly_flags) == 0:
        return 0.15  # Very low risk

    # If NO anomaly flags and GNN says it's safe, trust that
    if len(anomaly_flags) == 0 and gnn_score < 0.5:
        return gnn_score * 0.9

    # If 1-2 flags but GNN is low, be conservative
    if len(anomaly_flags) <= 2 and gnn_score < 0.6:
        # Weight: 70% GNN, 30% mock
        final_score = (gnn_score * 0.7) + (mock_risk_score * 0.3)
    else:
        # If 3+ flags or high GNN, blend equally
        final_score = (gnn_score * 0.6) + (mock_risk_score * 0.4)

    # CRITICAL ANOMALY FLAGS: +0.20 per critical flag
    critical_flags = ["blacklisted_vpa", "impossible_travel"]
    critical_penalty = 0.0
    for flag in critical_flags:
        if flag in anomaly_flags:
            critical_penalty += 0.20

    # MEDIUM ANOMALY FLAGS: +0.05 per medium flag
    medium_flags = ["mule_receiver", "mule_account", "unusual_amount"]
    medium_penalty = 0.0
    for flag in medium_flags:
        if flag in anomaly_flags:
            medium_penalty += 0.05

    final_score = min(final_score + critical_penalty + medium_penalty, 1.0)
    return final_score

def generate_reason(anomaly_flags: List[str], gnn_score: float, mock_risk_score: float) -> str:
    """Generate reason, only if there's actual risk."""

    if not anomaly_flags and gnn_score < 0.5:
        return "Transaction cleared: Normal patterns detected."

    reasons: List[str] = []

    for flag in anomaly_flags:
        if flag == "blacklisted_vpa":
            reasons.append("VPA is flagged in fraud watchlist")
        elif flag == "impossible_travel":
            reasons.append("Impossible travel between locations detected")
        elif flag in ("mule_receiver", "mule_account"):
            reasons.append("Receiver shows suspicious money collection pattern")
        elif flag == "unusual_amount":
            reasons.append("Amount significantly exceeds sender's typical patterns")
        elif flag == "night_transaction":
            reasons.append("High-risk time window (11 PM - 7 AM)")
        elif flag == "new_receiver":
            reasons.append("First transaction to this receiver")

    if gnn_score >= 0.7:
        reasons.append(f"AI model high-confidence flag (score: {gnn_score:.2f})")

    return "; ".join(reasons) if reasons else "Transaction cleared."

@app.post("/analyze")
def analyze_transaction_post(txn: TransactionPayload):
    """
    POST endpoint for full transaction risk analysis.
    Called by the Node.js server during transaction processing.
    """
    # 1. Store stateful data
    record_transaction_time(txn.senderVpa)
    push_transaction(txn.senderVpa, txn.amount)

    # 2. Extract features
    features_vector = extract_features(txn.model_dump())
    print(f"DEBUG [Feature Extraction output]: {features_vector}")

    # 3. Build graph from recent transaction history
    recent_amts = get_recent_transactions(txn.senderVpa, limit=5)

    graph_features_list = [features_vector]
    for hist_amt in recent_amts:
        hist_vector = [0.0] * 8
        hist_vector[0] = math.log1p(hist_amt)
        hist_vector[1] = 1.0 if hist_amt > 0 and hist_amt % 1000 == 0 else 0.0
        graph_features_list.append(hist_vector)

    graph = build_transaction_graph(graph_features_list)

    # 4. GNN Inference
    with torch.no_grad():
        out = model(graph.x, graph.edge_index)
        gnn_score = out[0].item()
        
    print(f"DEBUG [GNN inference]: gnn_score={gnn_score}")

    # 5. Normalize heuristics
    velocity_raw = features_vector[6]
    velocity_score_normalized = min(1.0, velocity_raw / 10.0)
    location_risk_score = features_vector[7]
    
    print(f"DEBUG [Normalization]: velocity_score_normalized={velocity_score_normalized}, location_risk_score={location_risk_score}")

    # 6. Amount-based progressive risk
    if txn.amount < 1000:
        amount_risk = 0.0
    elif txn.amount < 10000:
        amount_risk = 0.2
    elif txn.amount < 100000:
        amount_risk = 0.5
    else:
        amount_risk = 1.0

    # 7. Behavioral anomaly score via Node.js
    behavioral_score = 0.0
    if txn.userId:
        try:
            profile_resp = httpx.post(
                f"http://localhost:5000/api/users/{txn.userId}/profile-check",
                json={"transaction": txn.model_dump()},
                timeout=5.0
            )
            if profile_resp.status_code == 200:
                profile_data = profile_resp.json()
                if profile_data.get("isAnomalous"):
                    behavioral_score = 0.10
                    print(f"DEBUG [Behavioral]: Anomaly detected: {profile_data.get('anomalousFactors')}")
        except Exception as e:
            print(f"DEBUG [Behavioral Check Failed]: {e}")

    # 8. Receiver risk score (passed from Node.js backend)
    receiver_risk_score = float(txn.receiverRiskScore or 0.0)
    receiver_category = "UNKNOWN"
    if receiver_risk_score < 0.2:
        receiver_category = "SAFE"
    elif receiver_risk_score < 0.5:
        receiver_category = "SUSPICIOUS"
    elif receiver_risk_score < 0.8:
        receiver_category = "HIGH_RISK"
    else:
        receiver_category = "FRAUD_MULE"

    print(f"DEBUG [Receiver Risk]: score={receiver_risk_score}, category={receiver_category}")

    # 9. Production scoring — updated weights (sum to 1.0)
    # GNN: 0.30, Location: 0.20, Amount: 0.15, Velocity: 0.15, Behavioral: 0.10, Receiver: 0.10
    final_score = (
        (0.30 * gnn_score) +               # Reduced from 0.35
        (0.20 * location_risk_score) +
        (0.15 * amount_risk) +             # Reduced from 0.20
        (0.15 * velocity_score_normalized) +
        (0.10 * behavioral_score) +
        (0.10 * receiver_risk_score)        # NEW: receiver-side intelligence
    )
    final_score = float(final_score)

    # Hard override — obvious fraud signals that GNN may miss due to synthetic training
    if txn.amount >= 100000 and location_risk_score >= 0.8:
        final_score = max(final_score, 0.85)

    if txn.amount >= 50000 and location_risk_score >= 0.5:
        final_score = max(final_score, 0.70)

    # Apply mock data enrichment if available
    mock_context_used = False
    if txn.mockContext:
        anomaly_flags = txn.mockContext.get("anomalyFlags", [])
        mock_risk_score = txn.mockContext.get("mockRiskScore", 0)
        sender_behavior = txn.mockContext.get("senderBehavior", {})
        receiver_validation = txn.mockContext.get("receiverValidation", {})
        
        final_score = blend_scores(
            gnn_score=final_score,
            mock_risk_score=mock_risk_score,
            anomaly_flags=anomaly_flags,
            sender_behavior=sender_behavior,
            receiver_validation=receiver_validation
        )
        mock_context_used = True

    print(f"DEBUG [Scoring Phase]: amount_risk={amount_risk}, final_score={final_score}")

    # 10. Explainability
    if mock_context_used:
        reason = generate_reason(anomaly_flags, gnn_score, mock_risk_score)
    else:
        reason = generate_explanation(features_vector, final_score)

    # 11. Attribution breakdown — updated weights
    gnn_contribution = 0.30 * gnn_score
    velocity_contribution = 0.15 * velocity_score_normalized
    location_contribution = 0.20 * location_risk_score
    amount_contribution = 0.15 * amount_risk
    behavioral_contribution = 0.10 * behavioral_score
    receiver_contribution = 0.10 * receiver_risk_score
    
    attribution = {
        "gnn": {
            "weight": 0.30,
            "value": gnn_score,
            "contribution": gnn_contribution,
            "reason": "Graph Neural Network detected patterns consistent with fraud ring activity"
        },
        "location": {
            "weight": 0.20,
            "value": location_risk_score,
            "contribution": location_contribution,
            "reason": f"Location '{txn.location}' is flagged as high-risk" if location_risk_score > 0.5 else "Location appears safe"
        },
        "amount": {
            "weight": 0.15,
            "value": amount_risk,
            "contribution": amount_contribution,
            "reason": f"Amount ₹{txn.amount:,.0f} is unusually large" if amount_risk > 0.5 else "Amount is within normal range"
        },
        "velocity": {
            "weight": 0.15,
            "value": velocity_score_normalized,
            "contribution": velocity_contribution,
            "reason": "High transaction velocity detected in short time window" if velocity_score_normalized > 0.3 else "Velocity is normal"
        },
        "behavioral": {
            "weight": 0.10,
            "value": behavioral_score,
            "contribution": behavioral_contribution,
            "reason": "Transaction deviates from user's normal behavior pattern" if behavioral_score > 0.05 else "Behavior is consistent with user's pattern"
        },
        "receiver": {
            "weight": 0.10,
            "value": receiver_risk_score,
            "contribution": receiver_contribution,
            "reason": f"Receiver VPA has {receiver_category} risk profile" if receiver_risk_score > 0 else "Receiver has no prior fraud history"
        }
    }

    # 12. Response — calibrated thresholds
    if final_score >= 0.70:
        response_dict = {
            "status": "High Risk",
            "action": "FREEZE",
            "reason": reason,
            "riskScore": final_score,
            "attribution": attribution,
            "mockContextUsed": mock_context_used
        }
    elif final_score >= 0.50:
        response_dict = {
            "status": "Suspicious",
            "action": "PENDING",
            "reason": reason,
            "riskScore": final_score,
            "attribution": attribution,
            "mockContextUsed": mock_context_used
        }
    else:
        response_dict = {
            "status": "Safe",
            "action": "ALLOW",
            "reason": reason,
            "riskScore": final_score,
            "attribution": attribution,
            "mockContextUsed": mock_context_used
        }
        
    print(f"DEBUG [Response generated]: {response_dict}")
    return response_dict


class AlertPayload(BaseModel):
    transactionId: str
    amount: float
    senderVpa: str
    rrn: str
    riskScore: float
    reason: str

@app.post("/webhook/freeze-alert")
async def trigger_freeze_alert(payload: AlertPayload):
    """
    Webhook called to trigger Node.js Twilio alerts directly.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:5000/api/alerts/test",
                json={"transactionId": payload.transactionId},
                headers={"Content-Type": "application/json"}
            )
            print(f"[FastAPI] Dispatched alert to Node.js backend: {response.status_code}")
    except Exception as e:
        print(f"[FastAPI] Webhook alert dispatch bypass failed: {str(e)}")
        
    return {"message": "Webhook alert event dispatched internally"}