import { Response } from "express";
import { processTransaction, getAllTransactions, getTransactionById, getTransactionTrends, getVpaHistoricalStats } from "../services/transaction.service.js";
import { buildEnrichedContext } from "../services/mock-data.service.js";
import { getOrCreateUser } from "../services/user.service.js";
import type { AuthenticatedRequest, TransactionBody, ApiResponse, EnrichedTransactionContext } from "../types/index.js";

/**
 * POST /api/transactions/process
 * Receives a transaction, enriches it with realistic behavioral context from the
 * Mock Data Engine (Phase 12), then runs it through the AI pipeline.
 *
 * Enrichment is non-blocking — if it fails, the raw transaction is still processed.
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

    // Phase 12: Enrich the transaction with mock behavioral context
    let enrichedContext: EnrichedTransactionContext | null = null;
    try {
        enrichedContext = buildEnrichedContext(senderVpa, receiverVpa, amount, location, new Date());
        console.log(
            `[FraudShield:MockData] Sender=${senderVpa} | ` +
            `RiskProfile=${enrichedContext.senderBehavior.riskProfile} | ` +
            `Flags=[${enrichedContext.anomalyFlags.join(', ') || 'none'}] | ` +
            `MockScore=${enrichedContext.mockRiskScore}`
        );
    } catch (err) {
        // Enrichment failure is non-fatal — AI pipeline proceeds with raw data
        console.warn('[FraudShield:MockData] Context enrichment failed (non-fatal):', err);
    }

    // Auto-create sender user if doesn't exist
    await getOrCreateUser(senderVpa);

    const transaction = await processTransaction({ senderVpa, receiverVpa, amount, location }, enrichedContext ?? undefined);

    res.status(200).json({
        success: true,
        message: transaction.status === "FROZEN"
            ? "⚠️ Transaction frozen — flagged as high risk by our AI engine"
            : "✅ Transaction processed successfully",
        data: {
            ...transaction,
            // Surface mock enrichment data for the dashboard modal
            anomalyFlags: enrichedContext?.anomalyFlags ?? [],
            mockRiskScore: enrichedContext?.mockRiskScore ?? null,
            senderProfile: enrichedContext?.senderBehavior ?? null,
            receiverMuleScore: enrichedContext?.receiverBehavior.muleScore ?? null,
            senderVpaRisk: enrichedContext?.senderValidation.bankRiskScore ?? null,
            receiverVpaRisk: enrichedContext?.receiverValidation.bankRiskScore ?? null,
            receiverRecommendedAction: enrichedContext?.receiverValidation.recommendedAction ?? null,
        },
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

/**
 * GET /api/transactions/:id/attribution
 * Returns SHAP-style attribution logs isolated securely mapping direct breakdown data natively.
 */
export async function getAttribution(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const transaction = await getTransactionById(id as string);

    if (!transaction) {
        res.status(404).json({ success: false, message: "Transaction not found" } satisfies ApiResponse);
        return;
    }

    if (!transaction.attributionData) {
        res.status(404).json({ success: false, message: "Attribution vector unavailable for tracking." } satisfies ApiResponse);
        return;
    }

    res.status(200).json({
        success: true,
        message: "Attribution vector retrieved",
        data: JSON.parse(transaction.attributionData),
    } satisfies ApiResponse);
}

/**
 * GET /api/transactions/trends
 * Returns hourly fraud-rate trend data for the analytics page.
 * Phase 12: Shows how fraud rate climbs at night, driven by mock data patterns.
 */
export async function getTrends(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const trends = await getTransactionTrends();
    res.status(200).json({
        success: true,
        message: `Trend data across ${trends.reduce((s, t) => s + t.total, 0)} transactions`,
        data: trends,
    } satisfies ApiResponse);
}

/**
 * GET /api/transactions/vpa-stats/:vpa
 * Returns historical statistics for a specific VPA address.
 * Phase 12: Exposes per-VPA fraud rate, amount averages, and location data.
 */
export async function getVpaStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { vpa } = req.params;
    if (!vpa) {
        res.status(400).json({ success: false, message: 'VPA is required' } satisfies ApiResponse);
        return;
    }
    const stats = await getVpaHistoricalStats(decodeURIComponent(vpa as string));
    res.status(200).json({
        success: true,
        message: `Historical stats for ${vpa}`,
        data: stats,
    } satisfies ApiResponse);
}
