import os
import json
import random
import math
import pandas as pd
from datetime import datetime, timedelta
import numpy as np

# Ensure necessary directories exist
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

# File paths
CSV_PATH = os.path.join(DATA_DIR, "transactions.csv")
STATS_PATH = os.path.join(DATA_DIR, "dataset_stats.json")

# Constants
LEGIT_COUNT = 12000
FRAUD_COUNT = 3000
TOTAL_COUNT = LEGIT_COUNT + FRAUD_COUNT

CITIES_SAFE = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata", "Ahmedabad"]
CITIES_RISKY = ["Unknown", "Foreign", "Suspicious"]

VPAS = [f"user{i}@upi" for i in range(1, 500)]
DOMAINS = ["upi", "okaxis", "ybl", "ibl"]

def generate_legitimate(noise=False):
    # Legitimate characteristics
    amount = float(random.randint(50, 15000))
    sender = random.choice(VPAS)
    receiver = random.choice(VPAS)
    while receiver == sender:
        receiver = random.choice(VPAS)
        
    location = random.choice(CITIES_SAFE)
    hour = random.randint(8, 22)
    velocity = random.randint(0, 2)
    amount_zscore = random.uniform(-0.5, 1.0)
    
    # 10% chance to add noise (make one aspect look like fraud)
    if noise:
        noise_type = random.randint(1, 5)
        if noise_type == 1: amount = float(random.randint(50000, 100000))
        elif noise_type == 2: location = random.choice(CITIES_RISKY)
        elif noise_type == 3: hour = random.randint(0, 5)
        elif noise_type == 4: velocity = random.randint(5, 8)
        elif noise_type == 5: amount_zscore = random.uniform(3.0, 5.0)

    is_night = 1.0 if 0 <= hour < 6 else 0.0
    is_round = 1.0 if amount % 1000 == 0 else 0.0
    vpa_domain_match = 1.0 if sender.split('@')[1] == receiver.split('@')[1] else 0.0
    amount_log = math.log1p(amount)
    
    # Basic lookup simulation
    location_risk = 1.0 if location in CITIES_RISKY else 0.1
    
    timestamp = (datetime.utcnow() - timedelta(days=random.randint(0, 30))).replace(hour=hour).isoformat() + "Z"

    return {
        "amount": amount, "senderVpa": sender, "receiverVpa": receiver,
        "location": location, "timestamp": timestamp, "hour_of_day": hour,
        "is_night": is_night, "is_round_amount": is_round, "vpa_domain_match": vpa_domain_match,
        "amount_log": amount_log, "velocity_score": velocity, "location_risk_score": location_risk,
        "amount_zscore": amount_zscore, "label": 0
    }

def generate_fraud():
    # Fraud characteristics
    amount = float(random.randint(50000, 500000))
    # Make round divisible by 1000 sometimes
    if random.random() < 0.7:
        amount = float(amount // 1000 * 1000)

    sender = random.choice(VPAS) + str(random.randint(100, 999)) # often new or unknown fake vpasa
    receiver = random.choice(VPAS)
    
    location = random.choice(CITIES_RISKY)
    hour = random.randint(0, 6)
    velocity = random.randint(5, 15)
    amount_zscore = random.uniform(3.0, 8.0)
    
    sender_domain = random.choice(DOMAINS)
    receiver_domain = random.choice(DOMAINS)
    while sender_domain == receiver_domain:
        sender_domain = random.choice(DOMAINS)
        
    sender = f"fraud{random.randint(1,999)}@{sender_domain}"
    receiver = f"victim{random.randint(1,99)}@{receiver_domain}"

    is_night = 1.0 if 0 <= hour < 6 else 0.0
    is_round = 1.0 if amount % 1000 == 0 else 0.0
    vpa_domain_match = 1.0 if sender_domain == receiver_domain else 0.0
    amount_log = math.log1p(amount)
    location_risk = 1.0
    
    timestamp = (datetime.utcnow() - timedelta(days=random.randint(0, 30))).replace(hour=hour).isoformat() + "Z"

    return {
        "amount": amount, "senderVpa": sender, "receiverVpa": receiver,
        "location": location, "timestamp": timestamp, "hour_of_day": hour,
        "is_night": is_night, "is_round_amount": is_round, "vpa_domain_match": vpa_domain_match,
        "amount_log": amount_log, "velocity_score": velocity, "location_risk_score": location_risk,
        "amount_zscore": amount_zscore, "label": 1
    }

def generate_dataset():
    random.seed(42)
    np.random.seed(42)

    data = []
    
    # 1. Generate 12000 legits
    for i in range(LEGIT_COUNT):
        noise = random.random() < 0.1 # 10% noise
        data.append(generate_legitimate(noise=noise))
        
    # 2. Generate 3000 frauds
    for i in range(FRAUD_COUNT):
        data.append(generate_fraud())
        
    df = pd.DataFrame(data)
    
    # Shuffle dataset
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    df.to_csv(CSV_PATH, index=False)
    
    # Create Stats
    stats = {
        "total_count": len(df),
        "fraud_count": len(df[df["label"] == 1]),
        "legitimate_count": len(df[df["label"] == 0]),
        "mean_amount": float(df["amount"].mean()),
        "std_amount": float(df["amount"].std()),
        "fraud_rate": float(len(df[df["label"] == 1]) / len(df))
    }
    
    with open(STATS_PATH, "w") as f:
        json.dump(stats, f, indent=4)
        
    print(f"Dataset generated: {TOTAL_COUNT} transactions ({FRAUD_COUNT} fraud, {LEGIT_COUNT} legitimate)")

if __name__ == "__main__":
    generate_dataset()
