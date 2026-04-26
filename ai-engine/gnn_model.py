import os
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GCNConv
from torch_geometric.data import Data

# Ensure the models directory exists
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)
MODEL_PATH = os.path.join(MODELS_DIR, "gnn_weights.pth")

class FraudGNN(nn.Module):
    def __init__(self, in_channels: int = 8, hidden_channels: int = 64):
        super(FraudGNN, self).__init__()
        # 2 layers of GCNConv
        self.conv1 = GCNConv(in_channels, hidden_channels)
        self.conv2 = GCNConv(hidden_channels, 1)

    def forward(self, x, edge_index):
        # Layer 1
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        # Layer 2
        x = self.conv2(x, edge_index)
        # Output binary classification with sigmoid
        return torch.sigmoid(x)

def load_or_initialize_model() -> FraudGNN:
    """
    Loads weights from ai-engine/models/gnn_weights.pth if it exists,
    otherwise initializes with random weights and saves them.
    """
    model = FraudGNN()
    if os.path.exists(MODEL_PATH):
        model.load_state_dict(torch.load(MODEL_PATH, weights_only=True))
    else:
        # Initialize randomly and save
        torch.save(model.state_dict(), MODEL_PATH)
    
    model.eval()
    return model

def build_transaction_graph(features_list: list[list[float]]) -> Data:
    """
    Constructs the PyTorch Geometric Data object from a list of recent transactions.
    features_list provides the nodes. The 0th node is presumed to be the current transaction,
    connected to up to the last 5 transactions from the same senderVpa (temporal neighborhood).
    """
    x = torch.tensor(features_list, dtype=torch.float)
    
    num_nodes = len(features_list)
    edge_src = []
    edge_dst = []
    
    # We create bidirectional edges between the current transaction (node 0) 
    # and historical nodes (nodes 1 to num_nodes - 1)
    for i in range(1, num_nodes):
        edge_src.extend([0, i])
        edge_dst.extend([i, 0])
        
    # If there's only 1 node (no history), add a self-loop
    if num_nodes == 1:
        edge_src.append(0)
        edge_dst.append(0)
        
    edge_index = torch.tensor([edge_src, edge_dst], dtype=torch.long)
    
    return Data(x=x, edge_index=edge_index)
