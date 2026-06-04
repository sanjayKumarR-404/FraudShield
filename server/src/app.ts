import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";
import recoveryRoutes from "./routes/recovery.routes.js";
import alertRoutes from "./routes/alert.routes.js";
import userRoutes from "./routes/user.routes.js";
import batchRoutes from "./routes/batch.routes.js";
import receiverRoutes from "./routes/receiver.routes.js";

const app = express();

// --- Global Middleware ---
app.use(cors());
app.use(express.json());

// --- Health Verification Route ---
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'FraudShield API', timestamp: new Date().toISOString() });
});

// --- API Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/recovery", recoveryRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/users", userRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/receivers", receiverRoutes);

// --- Global Error Handler (must be last) ---
app.use(errorHandler);

export default app;
