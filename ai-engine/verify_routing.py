from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_tests():
    print("Testing 1: Low risk payload")
    low_risk = {
        "amount": 500.0,
        "senderVpa": "test_safe_sender@upi",
        "receiverVpa": "test_safe_receiver@upi",
        "location": "Mumbai",
        "timestamp": "2026-04-26T12:00:00Z"
    }
    
    resp1 = client.post("/analyze", json=low_risk)
    print(f"Low risk response: {resp1.json()}")
    assert resp1.status_code == 200
    
    print("\nTesting 2: High risk payload")
    high_risk = {
        "amount": 250000.0,
        "senderVpa": "test_fraud_sender@upi",
        "receiverVpa": "test_fraud_receiver@upi",
        "location": "Unknown",
        "timestamp": "2026-04-26T03:00:00Z"
    }
    
    # Send rapidly to increase velocity score
    client.post("/analyze", json=high_risk)
    client.post("/analyze", json=high_risk)
    resp2 = client.post("/analyze", json=high_risk)
    print(f"High risk response: {resp2.json()}")
    assert resp2.status_code == 200

if __name__ == "__main__":
    run_tests()
    print("\nAll tests ran successfully!")
