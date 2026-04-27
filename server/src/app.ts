import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";
import recoveryRoutes from "./routes/recovery.routes.js";
import alertRoutes from "./routes/alert.routes.js";

const app = express();

// --- Global Middleware ---
app.use(cors());
app.use(express.json());

// --- Health Check ---
app.get("/health", (_req, res) => {
    res.json({ status: "operational", service: "FraudShield Server", timestamp: new Date().toISOString() });
});

// --- API Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/recovery", recoveryRoutes);
app.use("/api/alerts", alertRoutes);

// --- Global Error Handler (must be last) ---
app.use(errorHandler);

export default app;
