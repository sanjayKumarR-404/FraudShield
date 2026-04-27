import axios from "axios";
import { TransactionStatus } from "@prisma/client";
import prisma from "./prisma.service.js";
import { config } from "../config/index.js";
import type { TransactionBody, AIEngineResponse } from "../types/index.js";
import { sendFraudAlerts } from "./alert.service.js";

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
 * 2. Forward the payload to the Python AI engine for risk analysis.
 * 3. If the AI flags it as "High Risk", we freeze the transaction immediately.
 * 4. If the AI deems it "Safe", we mark it as SUCCESS.
 * 5. On AI engine failure, we default to FROZEN (fail-safe: freeze first).
 */
export async function processTransaction(payload: TransactionBody) {
    const rrn = generateRRN();
    const now = new Date();

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

    try {
        // Step 2: Call the Python AI engine for risk analysis
        console.log("[DEBUG] Calling AI engine at:", `${config.aiEngineUrl}/analyze`);
        const aiResponse = await axios.post<AIEngineResponse>(
            `${config.aiEngineUrl}/analyze`,
            {
                amount: payload.amount,
                senderVpa: payload.senderVpa,
                receiverVpa: payload.receiverVpa,
                location: payload.location,
                timestamp: now.toISOString(),
            },
            { timeout: 15000 }
        );

        const analysis = aiResponse.data;
        riskScore = analysis.riskScore;
        reason = analysis.reason;

        // Step 3/4: Apply the "Freeze First" logic
        if (analysis.status === "High Risk") {
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

    // Step 5: Update transaction with final verdict
    const updatedTransaction = await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: finalStatus, isFraud, reason, riskScore },
    });

    // Fire alerts in background — do not await, never block the freeze pipeline
    if (finalStatus === TransactionStatus.FROZEN) {
        sendFraudAlerts(updatedTransaction).catch(err =>
            console.error('[FraudShield] Alert dispatch failed:', err)
        );
    }

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
            receiver: { select: { id: true, email: true, upiVpa: true } },
        },
    });
}
