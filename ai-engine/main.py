from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"message": "FraudShield AI Engine is Online"}

@app.get("/analyze")
def analyze_transaction(amount: float):
    # This is a placeholder for our GNN logic later
    if amount > 100000:
        return {"status": "High Risk", "action": "Freeze"}
    return {"status": "Safe", "action": "Allow"}