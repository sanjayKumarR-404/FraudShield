import math
import numpy as np
import traceback
from datetime import datetime
from typing import Dict, Any, List

from redis_client import get_recent_transactions, get_velocity

HIGH_RISK_LOCATIONS = {"unknown", "foreign", "suspicious", "abroad", "international"}
LOW_RISK_INDIAN_CITIES = {"mumbai", "delhi", "bangalore", "chennai", "hyderabad", "pune", "kolkata", "ahmedabad", "jaipur", "surat"}

def get_location_score(location: str) -> float:
    if location is None or location == "":
        return 0.5
    loc_lower = location.lower()
    if loc_lower in HIGH_RISK_LOCATIONS:
        return 1.0
    if loc_lower in LOW_RISK_INDIAN_CITIES:
        return 0.1
    return 0.3

def extract_features(txn: Dict[str, Any]) -> List[float]:
    print(f"DEBUG [features.py input]: FEATURES INPUT: {txn}")
    try:
        amount = float(txn.get("amount", 0.0))
        sender_vpa = txn.get("senderVpa", "")
        receiver_vpa = txn.get("receiverVpa", "")
        location = txn.get("location", "")
        
        amount_log = math.log1p(amount)
        is_round_amount = 1.0 if amount > 0 and amount % 1000 == 0 else 0.0
        
        # Parse timestamp safely
        timestamp_str = txn.get("timestamp", datetime.utcnow().isoformat())
        dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        
        hour_of_day = float(dt.hour)
        is_night_transaction = 1.0 if 0 <= dt.hour < 6 else 0.0
        
        sender_domain = sender_vpa.split('@')[-1] if '@' in sender_vpa else ""
        receiver_domain = receiver_vpa.split('@')[-1] if '@' in receiver_vpa else ""
        vpa_domain_match = 1.0 if sender_domain == receiver_domain and sender_domain != "" else 0.0
        
        recent_amts = get_recent_transactions(sender_vpa, limit=100)
        if len(recent_amts) > 1:
            mean = np.mean(recent_amts)
            std = np.std(recent_amts)
            amount_zscore = float((amount - mean) / std) if std > 1e-5 else 0.0
        else:
            amount_zscore = 0.0
            
        velocity = get_velocity(sender_vpa, window_seconds=60)
        velocity_score = float(velocity)
        
        location_risk_score = get_location_score(location)
        
        features_vector = [
            amount_log,
            is_round_amount,
            hour_of_day,
            is_night_transaction,
            vpa_domain_match,
            amount_zscore,
            velocity_score,
            location_risk_score
        ]
        print(f"DEBUG [features.py output]: FEATURES OUTPUT: {features_vector}")
        return features_vector
    except Exception as e:
        traceback.print_exc()
        default_vector = [0.0, 0.0, 12.0, 0.0, 1.0, 0.0, 0.0, 0.3]
        print(f"DEBUG [features.py default]: FEATURES OUTPUT: {default_vector}")
        return default_vector
