from fastapi import FastAPI
from pydantic import BaseModel
import torch
import math

from redis_client import push_transaction, record_transaction_time, get_recent_transactions
from features import extract_features
from gnn_model import load_or_initialize_model, build_transaction_graph
from explainer import generate_explanation

app = FastAPI(title="FraudShield AI Engine", version="1.0.0")

# Load model globally on startup
model = load_or_initialize_model()

class TransactionPayload(BaseModel):
    """Incoming transaction data from the Node.js server."""
    amount: float
    senderVpa: str
    receiverVpa: str
    location: str
    timestamp: str

@app.get("/")
def home():
    return {"message": "FraudShield AI Engine is Online", "version": "1.0.0"}

@app.get("/analyze")
def analyze_transaction_get(amount: float):
    """Legacy GET endpoint for backward compatibility."""
    if amount > 100000:
        return {"status": "High Risk", "action": "Freeze", "reason": f"High amount: ₹{amount:,.2f}", "riskScore": 75.0}
    return {"status": "Safe", "action": "Allow", "reason": "Amount within normal range", "riskScore": 10.0}

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

    # 6. Improved safety override and scoring formula
    # Amount-based progressive risk adjustment
    if txn.amount < 1000:
        amount_risk = 0.0
    elif txn.amount < 10000:
        amount_risk = 0.2
    elif txn.amount < 100000:
        amount_risk = 0.5
    else:
        amount_risk = 1.0

    # Recalculate final score including amount risk
    final_score = (
        (0.15 * gnn_score) +
        (0.20 * velocity_score_normalized) +
        (0.40 * location_risk_score) +
        (0.25 * amount_risk)
    )
    final_score = float(final_score)

    # Hard floor for clearly safe transactions
    if txn.amount < 5000 and location_risk_score <= 0.3:
        final_score = min(final_score, 0.35)
        
    print(f"DEBUG [Scoring Phase]: final_score={final_score}")

    # 7. Explainability
    reason = generate_explanation(features_vector, final_score)

    # 8. Response — contract unchanged for Node.js compatibility
    if final_score >= 0.65:
        response_dict = {
            "status": "High Risk",
            "action": "FREEZE",
            "reason": reason,
            "riskScore": final_score
        }
    else:
        response_dict = {
            "status": "Safe",
            "action": "ALLOW",
            "reason": reason,
            "riskScore": final_score
        }
        
    print(f"DEBUG [Response generated]: {response_dict}")
    return response_dict