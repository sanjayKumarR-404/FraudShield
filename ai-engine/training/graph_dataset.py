import os
import torch
import pandas as pd
from torch_geometric.data import Data, Dataset

DATA_DIR = os.path.dirname(__file__)
CSV_PATH = os.path.join(DATA_DIR, "data", "transactions.csv")
PROC_DIR = os.path.join(DATA_DIR, "data", "processed")

# The 8 features must be strictly ordered
FEATURE_COLS = [
    "amount_log",
    "is_round_amount",
    "hour_of_day",
    "is_night",               # Extracted mapping maps to is_night_transaction
    "vpa_domain_match",
    "amount_zscore",
    "velocity_score",
    "location_risk_score"
]

class FraudGraphDataset(Dataset):
    def __init__(self, root, transform=None, pre_transform=None):
        self.raw_data_path = CSV_PATH
        super().__init__(root, transform, pre_transform)
        self.graphs = []
        self._build_graphs()

    @property
    def raw_file_names(self):
        return ["transactions.csv"]

    @property
    def processed_file_names(self):
        return ["graphs.pt"]

    def _build_graphs(self):
        # Only build in memory to avoid huge FS I/O for 15k small files
        # We save a single list
        proc_path = os.path.join(PROC_DIR, "graphs.pt")
        if os.path.exists(proc_path):
            self.graphs = torch.load(proc_path, weights_only=False)
            return

        print("Building graph structures from temporal correlations...")
        df = pd.read_csv(self.raw_data_path)
        
        # Sort by timestamp to ensure temporal ordering
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values(by="timestamp").reset_index()

        # Group by VPA to easily find previous transactions
        vpa_groups = df.groupby("senderVpa")
        
        # We want to map original dataframe index -> list of feature arrays
        for idx, row in df.iterrows():
            current_features = row[FEATURE_COLS].values.tolist()
            label = float(row["label"])
            
            # Find history:
            sender = row["senderVpa"]
            ts = row["timestamp"]
            
            # All transactions from this sender *strictly before* this timestamp
            history_df = vpa_groups.get_group(sender)
            history_df = history_df[history_df["timestamp"] < ts]
            history_df = history_df.tail(3) # up to 3 most recent
            
            nodes = [current_features]
            edge_src = []
            edge_dst = []
            
            # Construct up to 3 historical edges
            for h_idx, h_row in history_df.iterrows():
                h_feat = h_row[FEATURE_COLS].values.tolist()
                nodes.append(h_feat)
                curr_node_idx = len(nodes) - 1
                
                # Bidirectional edge between current transaction (0) and historical node
                edge_src.extend([0, curr_node_idx])
                edge_dst.extend([curr_node_idx, 0])
                
            # Self-loop if no history
            if len(nodes) == 1:
                edge_src.append(0)
                edge_dst.append(0)
                
            x = torch.tensor(nodes, dtype=torch.float)
            edge_index = torch.tensor([edge_src, edge_dst], dtype=torch.long)
            y = torch.tensor([label], dtype=torch.float)
            
            data = Data(x=x, edge_index=edge_index, y=y)
            self.graphs.append(data)
            
        os.makedirs(PROC_DIR, exist_ok=True)
        torch.save(self.graphs, proc_path)
        print(f"Graph dataset built: {len(self.graphs)} graphs")

    def len(self):
        return len(self.graphs)

    def get(self, idx):
        return self.graphs[idx]

if __name__ == "__main__":
    dataset = FraudGraphDataset(root=os.path.join(DATA_DIR, "data"))
    print(f"Dataset length verified: {dataset.len()}")
