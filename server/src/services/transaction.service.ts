import axios from "axios";
import { TransactionStatus } from "@prisma/client";
import prisma from "./prisma.service.js";
import { config } from "../config/index.js";
import type { TransactionBody, AIEngineResponse, EnrichedTransactionContext, TransactionTrend, VpaHistoricalStats } from "../types/index.js";
import { sendFraudAlerts } from "./alert.service.js";
import { syncUserProfile } from "../jobs/profile.job.js";
import { getReceiverRiskScore, updateReceiverProfile } from "./receiverProfile.service.js";

/**
 * Generate a 12-digit Reference Retrieval Number (RRN) for UPI transactions.
 */
function generateRRN(): string {
    return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
}

/**
 * Core transaction processing pipeline — "Freeze First, Confirm Later".
 *
 * Flow:
 * 1. Persist the transaction with PENDING status.
 * 2. Fetch receiver risk score for additional intelligence.
 * 3. Forward the payload to the Python AI engine for risk analysis.
 * 4. If the AI flags it as "High Risk", we freeze the transaction immediately.
 * 5. If the AI deems it "Safe", we mark it as SUCCESS.
 * 6. On AI engine failure, we default to FROZEN (fail-safe: freeze first).
 * 7. Asynchronously update receiver profile (non-blocking).
 */
/**
 * Optional Phase 12 enrichment context passed in from the controller.
 * When present, anomaly flags are logged and the mock risk score is surfaced.
 */
export async function processTransaction(
    payload: TransactionBody,
    enrichedContext?: EnrichedTransactionContext
) {
    const rrn = generateRRN();
    const now = new Date();

    // Phase 12: Log enriched context anomaly flags if available
    if (enrichedContext && enrichedContext.anomalyFlags.length > 0) {
        console.log(
            `[FraudShield:Enrichment] TXN flags=[${enrichedContext.anomalyFlags.join(',')}] ` +
            `mockScore=${enrichedContext.mockRiskScore} ` +
            `senderRisk=${enrichedContext.senderBehavior.riskProfile}`
        );
    }

    // Step 1: Save transaction as PENDING
    const transaction = await prisma.transaction.create({
        data: {
            senderVpa: payload.senderVpa,
            receiverVpa: payload.receiverVpa,
            amount: payload.amount,
            rrn,
            location: payload.location,
            status: TransactionStatus.PENDING,
            timestamp: now,
        },
    });

    let finalStatus: TransactionStatus;
    let isFraud = false;
    let reason = "Transaction processed successfully";
    let riskScore = 0;
    let attributionData: string | null = null;

    // Attempt lookup for anomaly detection mapping
    const user = await prisma.user.findUnique({ where: { upiVpa: payload.senderVpa } });

    // Step 2: Fetch receiver risk score before AI call
    let receiverRiskScore = 0;
    try {
        const receiverRisk = await getReceiverRiskScore(payload.receiverVpa);
        receiverRiskScore = receiverRisk.score;
        console.log(`[FraudShield] Receiver risk for ${payload.receiverVpa}: ${receiverRisk.score} (${receiverRisk.category})`);
    } catch (err) {
        console.warn("[FraudShield] Could not fetch receiver risk score:", err);
    }

    try {
        // Step 3: Call the Python AI engine for risk analysis
        console.log("[DEBUG] Calling AI engine at:", `${config.aiEngineUrl}/analyze`);
        const aiPayload: any = {
            amount: payload.amount,
            senderVpa: payload.senderVpa,
            receiverVpa: payload.receiverVpa,
            location: payload.location,
            timestamp: now.toISOString(),
            userId: user?.id || null,
            receiverRiskScore,
        };

        if (enrichedContext) {
            aiPayload.mockContext = {
                anomalyFlags: enrichedContext.anomalyFlags,
                mockRiskScore: enrichedContext.mockRiskScore,
                senderBehavior: enrichedContext.senderBehavior,
                receiverValidation: enrichedContext.receiverValidation,
            };
        }

        const aiResponse = await axios.post<AIEngineResponse>(
            `${config.aiEngineUrl}/analyze`,
            aiPayload,
            { timeout: 15000 }
        );

        const analysis = aiResponse.data;
        riskScore = analysis.riskScore;
        reason = analysis.reason;

        if (analysis.mockContextUsed) {
            console.log(`[FraudShield:AIEngine] Mock context integrated into final score: ${analysis.riskScore}`);
        }

        // Decision reasoning log
        const flagList = enrichedContext?.anomalyFlags?.join(', ') || 'none';
        console.log(`[FraudShield:Decision] Score=${analysis.riskScore.toFixed(4)} | Action=${analysis.status} | Flags=${flagList}`);

        if (analysis.attribution) {
            attributionData = JSON.stringify(analysis.attribution);
        }

        // Step 4/5: Apply the "Freeze First" logic — 3-tier response
        if (analysis.status === "High Risk") {
            finalStatus = TransactionStatus.FROZEN;
            isFraud = true;
        } else if (analysis.status === "Suspicious") {
            finalStatus = TransactionStatus.FROZEN;
            isFraud = true;
        } else {
            finalStatus = TransactionStatus.SUCCESS;
        }
    } catch (error) {
        // Fail-safe: if the AI engine is unreachable, freeze the transaction
        console.error("[FraudShield] AI engine unreachable — defaulting to FROZEN", error);
        finalStatus = TransactionStatus.FROZEN;
        reason = "AI engine unavailable — transaction frozen as precaution";
        riskScore = -1;
    }

    // Step 6: Update transaction with final verdict
    const updatedTransaction = await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
            status: finalStatus,
            isFraud,
            reason,
            riskScore,
            attributionData
        },
    });

    // Fire alerts in background — do not await, never block the freeze pipeline
    if (finalStatus === TransactionStatus.FROZEN) {
        sendFraudAlerts(updatedTransaction).catch(err =>
            console.error('[FraudShield] Alert dispatch failed:', err)
        );
    }

    if (user) {
        syncUserProfile(user.id);
    }

    // Step 7: Update receiver profile asynchronously — non-blocking
    updateReceiverProfile(
        payload.receiverVpa,
        payload.amount,
        finalStatus === TransactionStatus.FROZEN
    ).catch(err => console.error('[FraudShield] Receiver profile update failed:', err));

    return updatedTransaction;
}

/**
 * Retrieve all transactions, ordered by most recent first.
 */
export async function getAllTransactions() {
    return prisma.transaction.findMany({
        orderBy: { timestamp: "desc" },
        include: { sender: { select: { id: true, email: true, upiVpa: true } } },
    });
}

/**
 * Retrieve a single transaction by ID.
 */
export async function getTransactionById(id: string) {
    return prisma.transaction.findUnique({
        where: { id },
        include: {
            sender: { select: { id: true, email: true, upiVpa: true } },
        },
    });
}

/**
 * Phase 12: Returns hourly fraud-rate trend data over all stored transactions.
 *
 * Groups transactions by hour-of-day (0–23) and computes:
 *  - total count per hour
 *  - frozen (fraud) count per hour
 *  - fraud rate per hour (0–1)
 *
 * The result feeds the analytics charts — fraud rate climbs realistically
 * after 8 PM once mock data follows night-transaction patterns.
 */
export async function getTransactionTrends(): Promise<TransactionTrend[]> {
    const transactions = await prisma.transaction.findMany({
        select: { timestamp: true, status: true },
        orderBy: { timestamp: 'asc' },
    });

    const buckets: Map<number, { total: number; fraud: number }> = new Map();

    // Initialise all 24 hours to zero
    for (let h = 0; h < 24; h++) {
        buckets.set(h, { total: 0, fraud: 0 });
    }

    for (const tx of transactions) {
        const hour = new Date(tx.timestamp).getHours();
        const bucket = buckets.get(hour) ?? { total: 0, fraud: 0 };
        bucket.total++;
        if (tx.status === TransactionStatus.FROZEN) bucket.fraud++;
        buckets.set(hour, bucket);
    }

    const trends: TransactionTrend[] = [];
    for (let h = 0; h < 24; h++) {
        const b = buckets.get(h) ?? { total: 0, fraud: 0 };
        trends.push({
            hour: h,
            total: b.total,
            fraud: b.fraud,
            fraudRate: b.total > 0 ? Math.round((b.fraud / b.total) * 10000) / 10000 : 0,
        });
    }

    return trends;
}

/**
 * Phase 12: Returns historical transaction statistics for a given VPA.
 * Useful for the analytics page to surface per-sender/receiver trends.
 */
export async function getVpaHistoricalStats(vpa: string): Promise<VpaHistoricalStats> {
    const transactions = await prisma.transaction.findMany({
        where: {
            OR: [
                { senderVpa: vpa },
                { receiverVpa: vpa },
            ],
        },
        select: {
            amount: true,
            status: true,
            location: true,
            timestamp: true,
        },
        orderBy: { timestamp: 'desc' },
    });

    if (transactions.length === 0) {
        return {
            vpa,
            totalTransactions: 0,
            totalFrozen: 0,
            totalAmount: 0,
            avgAmount: 0,
            fraudRate: 0,
            mostCommonLocation: null,
            lastTransactionAt: null,
        };
    }

    const totalFrozen = transactions.filter((t) => t.status === TransactionStatus.FROZEN).length;
    const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const avgAmount = totalAmount / transactions.length;

    // Most common location
    const locationCounts: Record<string, number> = {};
    for (const t of transactions) {
        locationCounts[t.location] = (locationCounts[t.location] ?? 0) + 1;
    }
    const mostCommonLocation = Object.entries(locationCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
        vpa,
        totalTransactions: transactions.length,
        totalFrozen,
        totalAmount: Math.round(totalAmount * 100) / 100,
        avgAmount: Math.round(avgAmount * 100) / 100,
        fraudRate: Math.round((totalFrozen / transactions.length) * 10000) / 10000,
        mostCommonLocation,
        lastTransactionAt: transactions[0]?.timestamp ?? null,
    };
}
