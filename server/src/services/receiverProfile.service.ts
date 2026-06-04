import prisma from "./prisma.service.js";
import type { ReceiverRiskResult } from "../types/index.js";

/**
 * Calculates the receiver risk score using the formula:
 * receiver_risk = (fraudRate × 0.40) + (uniqueSenderVelocity × 0.30) + (newAccountFlag × 0.20) + (highAmountRatio × 0.10)
 */
function computeRiskScore(
    fraudRate: number,
    uniqueSenders: number,
    isNewAccount: boolean,
    avgAmount: number
): number {
    const uniqueSenderVelocity = Math.min(uniqueSenders / 20, 1.0); // 20+ senders = max velocity
    const newAccountFlag = isNewAccount ? 1.0 : 0.0;
    const highAmountRatio = Math.min(avgAmount / 100000, 1.0); // 100k+ avg = max

    return (
        fraudRate * 0.40 +
        uniqueSenderVelocity * 0.30 +
        newAccountFlag * 0.20 +
        highAmountRatio * 0.10
    );
}

function scoreToCategory(score: number): string {
    if (score < 0.2) return "SAFE";
    if (score < 0.5) return "SUSPICIOUS";
    if (score < 0.8) return "HIGH_RISK";
    return "FRAUD_MULE";
}

/**
 * Called after every transaction is processed.
 * Upserts the ReceiverProfile and recalculates risk score + category.
 * Non-blocking — should be called with .catch() in fire-and-forget mode.
 */
export async function updateReceiverProfile(
    receiverVpa: string,
    amount: number,
    wasFrozen: boolean
): Promise<void> {
    // Query last 24h transactions for this receiver to compute velocity
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentTransactions = await prisma.transaction.findMany({
        where: {
            receiverVpa,
            timestamp: { gte: since24h },
        },
        select: { senderVpa: true, amount: true },
    });

    const uniqueSendersSet = new Set(recentTransactions.map((t) => t.senderVpa));
    const uniqueSendersLast24h = uniqueSendersSet.size;
    const totalAmountLast24h = recentTransactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0
    );

    // Fetch or build existing profile stats
    const existing = await prisma.receiverProfile.findUnique({
        where: { receiverVpa },
    });

    const prevTotal = existing?.totalReceived ?? 0;
    const prevFraud = existing?.totalFraudFlagged ?? 0;

    const newTotal = prevTotal + 1;
    const newFraud = prevFraud + (wasFrozen ? 1 : 0);
    const fraudRate = newTotal > 0 ? newFraud / newTotal : 0;

    // Running average amount
    const prevAvg = existing?.avgAmountReceived ?? 0;
    const avgAmountReceived = (prevAvg * prevTotal + amount) / newTotal;

    // New account flag: created less than 7 days ago
    const firstSeenAt = existing?.firstSeenAt ?? new Date();
    const ageMs = Date.now() - firstSeenAt.getTime();
    const isNewAccount = ageMs < 7 * 24 * 60 * 60 * 1000;

    const riskScore = computeRiskScore(
        fraudRate,
        uniqueSendersLast24h,
        isNewAccount,
        avgAmountReceived
    );
    const riskCategory = scoreToCategory(riskScore);

    await prisma.receiverProfile.upsert({
        where: { receiverVpa },
        create: {
            receiverVpa,
            totalReceived: newTotal,
            totalFraudFlagged: newFraud,
            fraudRate,
            uniqueSendersLast24h,
            totalAmountLast24h,
            avgAmountReceived,
            isNewAccount,
            firstSeenAt,
            riskScore,
            riskCategory,
        },
        update: {
            totalReceived: newTotal,
            totalFraudFlagged: newFraud,
            fraudRate,
            uniqueSendersLast24h,
            totalAmountLast24h,
            avgAmountReceived,
            isNewAccount,
            riskScore,
            riskCategory,
        },
    });
}

/**
 * Returns risk score and category for a receiver VPA.
 * Returns default UNKNOWN if profile doesn't exist yet.
 */
export async function getReceiverRiskScore(
    receiverVpa: string
): Promise<ReceiverRiskResult> {
    const profile = await prisma.receiverProfile.findUnique({
        where: { receiverVpa },
    });

    if (!profile) {
        return { score: 0, category: "UNKNOWN", signals: [] };
    }

    const signals: string[] = [];

    if (profile.fraudRate > 0.5) {
        signals.push(`${(profile.fraudRate * 100).toFixed(0)}% of incoming transactions were frozen`);
    }
    if (profile.uniqueSendersLast24h >= 10) {
        signals.push(`Received from ${profile.uniqueSendersLast24h} unique senders in last 24h`);
    }
    if (profile.isNewAccount) {
        signals.push("Account is less than 7 days old");
    }
    if (profile.avgAmountReceived > 50000) {
        signals.push(`High average received amount: ₹${profile.avgAmountReceived.toLocaleString("en-IN")}`);
    }
    if (profile.riskCategory === "FRAUD_MULE") {
        signals.push("Classified as FRAUD MULE — matches money mule patterns");
    }

    return {
        score: profile.riskScore,
        category: profile.riskCategory,
        signals,
    };
}
