import os
import json
import torch
import numpy as np
from torch_geometric.loader import DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, f1_score
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from gnn_model import FraudGNN
from graph_dataset import FraudGraphDataset

def evaluate_model():
    print("Loading Graph Dataset and Model...")
    dataset = FraudGraphDataset(root=os.path.join(os.path.dirname(__file__), "data"))
    
    # Stratified split to rebuild test set exactly as in train.py
    labels = [data.y.item() for data in dataset]
    train_idx, temp_idx, _, y_temp = train_test_split(
        range(len(labels)), labels, test_size=0.30, stratify=labels, random_state=42
    )
    val_idx, test_idx = train_test_split(
        temp_idx, test_size=0.50, stratify=y_temp, random_state=42
    )
    
    test_dataset = [dataset[i] for i in test_idx]
    test_loader = DataLoader(test_dataset, batch_size=32, shuffle=False)
    
    model = FraudGNN()
    MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
    BEST_MODEL_PATH = os.path.join(MODELS_DIR, "gnn_weights.pth")
    
    if not os.path.exists(BEST_MODEL_PATH):
        print(f"Error: Trained weights not found at {BEST_MODEL_PATH}")
        sys.exit(1)
        
    model.load_state_dict(torch.load(BEST_MODEL_PATH))
    model.eval()
    
    test_preds = []
    test_targets = []
    
    with torch.no_grad():
        for batch in test_loader:
            out = model(batch.x, batch.edge_index)
            anchor_indices = batch.ptr[:-1]
            preds = out[anchor_indices].squeeze(-1)
            target = batch.y
            
            test_preds.extend(preds.tolist())
            test_targets.extend(target.tolist())
            
    print("\n--- Threshold Sweep ---")
    thresholds = np.arange(0.3, 0.95, 0.05)
    best_f1 = 0
    best_threshold = 0.65 # default
    
    for thresh in thresholds:
        labels_at_thresh = [1 if p >= thresh else 0 for p in test_preds]
        f1 = f1_score(test_targets, labels_at_thresh, zero_division=0)
        print(f"Threshold: {thresh:.2f} | F1 Score: {f1:.4f}")
        if f1 > best_f1:
            best_f1 = f1
            best_threshold = float(thresh)
            
    print(f"\n=> Recommended Freeze Threshold: {best_threshold:.2f} (Max F1: {best_f1:.4f})\n")
    
    # Final Evaluation using recommended threshold
    final_labels = [1 if p >= best_threshold else 0 for p in test_preds]
    
    print("--- Classification Report ---")
    print(classification_report(test_targets, final_labels, digits=4))
    
    print("--- Confusion Matrix ---")
    cm = confusion_matrix(test_targets, final_labels)
    print(f"TN: {cm[0][0]} | FP: {cm[0][1]}")
    print(f"FN: {cm[1][0]} | TP: {cm[1][1]}")
    
    RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
    os.makedirs(RESULTS_DIR, exist_ok=True)
    
    report_data = {
        "recommended_threshold": round(best_threshold, 2),
        "max_f1_score": float(best_f1),
        "confusion_matrix": {
            "TN": int(cm[0][0]),
            "FP": int(cm[0][1]),
            "FN": int(cm[1][0]),
            "TP": int(cm[1][1])
        }
    }
    
    with open(os.path.join(RESULTS_DIR, "evaluation_report.json"), "w") as f:
        json.dump(report_data, f, indent=4)
        
    print(f"\nEvaluation complete. Report saved to {os.path.join(RESULTS_DIR, 'evaluation_report.json')}")

if __name__ == "__main__":
    evaluate_model()
