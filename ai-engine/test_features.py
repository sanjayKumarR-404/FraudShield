from features import extract_features

def run_tests():
    tests = [
        {"desc": "amount=500, location='Mumbai'", "payload": {"amount": 500, "senderVpa": "test@upi", "receiverVpa": "test2@upi", "location": "Mumbai", "timestamp": "2024-01-15T11:00:00Z"}, "expected": 0.1},
        {"desc": "amount=250000, location='Unknown'", "payload": {"amount": 250000, "senderVpa": "test@upi", "receiverVpa": "test2@upi", "location": "Unknown", "timestamp": "2024-01-15T11:00:00Z"}, "expected": 1.0},
        {"desc": "amount=5000, location='bangalore'", "payload": {"amount": 5000, "senderVpa": "test@upi", "receiverVpa": "test2@upi", "location": "bangalore", "timestamp": "2024-01-15T11:00:00Z"}, "expected": 0.1},
        {"desc": "amount=1000, location=''", "payload": {"amount": 1000, "senderVpa": "test@upi", "receiverVpa": "test2@upi", "location": "", "timestamp": "2024-01-15T11:00:00Z"}, "expected": 0.5},
        {"desc": "amount=75000, location='Suspicious'", "payload": {"amount": 75000, "senderVpa": "test@upi", "receiverVpa": "test2@upi", "location": "Suspicious", "timestamp": "2024-01-15T11:00:00Z"}, "expected": 1.0},
    ]

    for t in tests:
        features = extract_features(t['payload'])
        loc_risk = features[7]
        if loc_risk == t['expected']:
            print(f"PASS: {t['desc']} -> {loc_risk}")
        else:
            print(f"FAIL: {t['desc']} -> Actual: {loc_risk}, Expected: {t['expected']}")

if __name__ == "__main__":
    run_tests()
