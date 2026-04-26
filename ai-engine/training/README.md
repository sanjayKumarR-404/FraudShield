# FraudShield Phase 4 GNN Training Pipeline

This directory contains the necessary modules to train and evaluate the PyTorch Geometric local graph network predicting internal fraud nodes inside the `FraudShield` infrastructure. By building deterministic spatial mapping tied directly against temporal transaction topologies, the GNN replaces standard hardcoded heuristics.

## Step 1: Synthesize Network Dataset
```bash
python generate_dataset.py
```
**Expected Output:** Builds `data/transactions.csv` containing precisely 15,000 randomized temporal records modeling standard usage patterns blended softly with chaotic noise variants.
**Approximate Runtime:** < 5 seconds.

## Step 2: Build Tensor Embeddings
```bash
python graph_dataset.py
```
**Expected Output:** Reads `transactions.csv` scaling indices into discrete PyTorch geometry `torch_geometric.data.Data` packages containing multi-node spatial mappings (up to 3 historical events matched strictly to relative sender VPAs).
**Approximate Runtime:** 1 to 2 minutes depending on IO.

## Step 3: Run Binary Model Training
```bash
python train.py
```
**Expected Output:** Iterates `FraudGNN` backward propagating weights weighted towards minority subsets (BCE with 4.0 scaling) saving finalized model states dynamically per evaluation progression limits.
**Approximate Runtime:** < 5 minutes CPU scaling.

## Step 4: Evaluate the Baseline Thresholds
```bash
python evaluate.py
```
**Expected Output:** Generates extensive confusion matrix parameterization via simulated threshold increments returning `recommended_threshold`. Node Server instances globally adopt this threshold.
**Approximate Runtime:** < 5 seconds.
