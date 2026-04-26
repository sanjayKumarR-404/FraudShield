import os
import json
import torch
import torch.nn as nn
from torch_geometric.loader import DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
import sys

# Import custom modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from gnn_model import FraudGNN
from graph_dataset import FraudGraphDataset

torch.manual_seed(42)

def train_model():
    print("Loading Graph Dataset...")
    dataset = FraudGraphDataset(root=os.path.join(os.path.dirname(__file__), "data"))
    
    # Stratified split: 70% train, 15% val, 15% test
    labels = [data.y.item() for data in dataset]
    # First split 70 / 30
    train_idx, temp_idx, _, y_temp = train_test_split(
        range(len(labels)), labels, test_size=0.30, stratify=labels, random_state=42
    )
    # Then split 30 into 15 / 15
    val_idx, test_idx = train_test_split(
        temp_idx, test_size=0.50, stratify=y_temp, random_state=42
    )
    
    train_dataset = [dataset[i] for i in train_idx]
    val_dataset = [dataset[i] for i in val_idx]
    test_dataset = [dataset[i] for i in test_idx]
    
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=32, shuffle=False)
    
    model = FraudGNN()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-4)
    # Binary Cross Entropy with pos_weight for handling 80/20 class imbalance
    # We weight the fraud class (1) by 4.0
    criterion = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([4.0]))

    # Modify GNN briefly to return raw logits since BCEWithLogitsLoss expects raw outputs
    # We will compute the loss on logits, and metrics on activations.
    # Wait, the prompt says do not modify gnn_model.py, architecture is frozen!
    # "Output: sigmoid binary classification"
    # BCEWithLogitsLoss expects LOGITS. If the model outputs sigmoid, we MUST use BCELoss.
    criterion = nn.BCELoss(weight=None) # We will implement class weights manually

    best_val_loss = float('inf')
    patience = 10
    patience_counter = 0
    epochs = 50
    
    MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
    os.makedirs(MODELS_DIR, exist_ok=True)
    BEST_MODEL_PATH = os.path.join(MODELS_DIR, "gnn_weights.pth")
    
    print("Starting Training...")
    
    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0
        
        for batch in train_loader:
            optimizer.zero_grad()
            out = model(batch.x, batch.edge_index)
            # The model outputs node probabilities for ALL nodes in the graphs.
            # We only care about the anchor node (the current transaction).
            # PyTorch Geometric batches multiple graphs into one disjoint graph.
            # The anchor node of graph `i` in the batch is at `batch.ptr[i]`.
            anchor_indices = batch.ptr[:-1]
            
            preds = out[anchor_indices].squeeze(-1)
            target = batch.y
            
            # Manual sample weighting
            weights = torch.where(target == 1.0, 4.0, 1.0)
            loss = nn.BCELoss(weight=weights)(preds, target)
            
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * batch.num_graphs
            
        train_loss = total_loss / len(train_dataset)
        
        # Validation
        model.eval()
        val_loss = 0
        all_preds = []
        all_targets = []
        
        with torch.no_grad():
            for batch in val_loader:
                out = model(batch.x, batch.edge_index)
                anchor_indices = batch.ptr[:-1]
                preds = out[anchor_indices].squeeze(-1)
                target = batch.y
                
                weights = torch.where(target == 1.0, 4.0, 1.0)
                loss = nn.BCELoss(weight=weights)(preds, target)
                val_loss += loss.item() * batch.num_graphs
                
                all_preds.extend(preds.tolist())
                all_targets.extend(target.tolist())
                
        val_loss /= len(val_dataset)
        pred_labels = [1 if p >= 0.5 else 0 for p in all_preds]
        
        val_acc = accuracy_score(all_targets, pred_labels)
        val_f1 = f1_score(all_targets, pred_labels, zero_division=0)
        
        print(f"Epoch {epoch:02d} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.4f} | Val F1: {val_f1:.4f}")
        
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            torch.save(model.state_dict(), BEST_MODEL_PATH)
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print("Early stopping triggered")
                break

    print(f"\nTraining Complete. Best weights saved to: {BEST_MODEL_PATH}")
    
    # Test Evaluation
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
            
    test_labels = [1 if p >= 0.5 else 0 for p in test_preds]
    test_acc = accuracy_score(test_targets, test_labels)
    test_prec = precision_score(test_targets, test_labels, zero_division=0)
    test_rec = recall_score(test_targets, test_labels, zero_division=0)
    test_f1 = f1_score(test_targets, test_labels, zero_division=0)
    test_auc = roc_auc_score(test_targets, test_preds)
    
    print("\n--- Test Set Metrics ---")
    print(f"Accuracy:  {test_acc:.4f}")
    print(f"Precision: {test_prec:.4f}")
    print(f"Recall:    {test_rec:.4f}")
    print(f"F1 Score:  {test_f1:.4f}")
    print(f"AUC-ROC:   {test_auc:.4f}")

    RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
    os.makedirs(RESULTS_DIR, exist_ok=True)
    
    log_data = {
        "best_val_loss": best_val_loss,
        "test_accuracy": test_acc,
        "test_precision": test_prec,
        "test_recall": test_rec,
        "test_f1": test_f1,
        "test_auc_roc": test_auc
    }
    with open(os.path.join(RESULTS_DIR, "training_log.json"), "w") as f:
        json.dump(log_data, f, indent=4)

if __name__ == "__main__":
    train_model()
