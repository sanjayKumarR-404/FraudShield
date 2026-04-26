import { Response } from "express";
import { processTransaction, getAllTransactions, getTransactionById } from "../services/transaction.service.js";
import type { AuthenticatedRequest, TransactionBody, ApiResponse } from "../types/index.js";

/**
 * POST /api/transactions/process
 * Receives a transaction, runs it through the AI engine, and returns the verdict.
 */
export async function process(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { senderVpa, receiverVpa, amount, location } = req.body as TransactionBody;

    if (!senderVpa || !receiverVpa || !amount || !location) {
        res.status(400).json({
            success: false,
            message: "Fields senderVpa, receiverVpa, amount, and location are required",
        } satisfies ApiResponse);
        return;
    }

    if (amount <= 0) {
        res.status(400).json({ success: false, message: "Amount must be greater than zero" } satisfies ApiResponse);
        return;
    }

    if (senderVpa === receiverVpa) {
        res.status(400).json({ success: false, message: "Sender and receiver VPA cannot be the same" } satisfies ApiResponse);
        return;
    }

    const transaction = await processTransaction({ senderVpa, receiverVpa, amount, location });

    const statusCode = transaction.status === "FROZEN" ? 200 : 200;

    res.status(statusCode).json({
        success: true,
        message: transaction.status === "FROZEN"
            ? "⚠️ Transaction frozen — flagged as high risk by our AI engine"
            : "✅ Transaction processed successfully",
        data: transaction,
    } satisfies ApiResponse);
}

/**
 * GET /api/transactions
 * Returns all transactions for the authenticated user.
 */
export async function getAll(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const transactions = await getAllTransactions();

    res.status(200).json({
        success: true,
        message: `Retrieved ${transactions.length} transactions`,
        data: transactions,
    } satisfies ApiResponse);
}

/**
 * GET /api/transactions/:id
 * Returns a single transaction by its ID.
 */
export async function getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const transaction = await getTransactionById(id as string);

    if (!transaction) {
        res.status(404).json({ success: false, message: "Transaction not found" } satisfies ApiResponse);
        return;
    }

    res.status(200).json({
        success: true,
        message: "Transaction retrieved",
        data: transaction,
    } satisfies ApiResponse);
}
