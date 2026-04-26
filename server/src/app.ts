import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

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

// --- Global Error Handler (must be last) ---
app.use(errorHandler);

export default app;
