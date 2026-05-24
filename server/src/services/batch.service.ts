import { parse } from 'csv-parse/sync';
import prisma from './prisma.service.js';
import { processTransaction } from './transaction.service.js';

export async function parseCsvFile(fileBuffer: Buffer) {
    try {
        const records = parse(fileBuffer, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        const validTransactions = [];
        let errorCount = 0;

        for (const record of records) {
            const { senderVpa, receiverVpa, amount, location } = record;

            if (!senderVpa || !receiverVpa || !amount || !location) {
                errorCount++;
                continue;
            }

            const numAmount = Number(amount);
            if (isNaN(numAmount) || numAmount <= 0) {
                errorCount++;
                continue;
            }

            validTransactions.push({
                senderVpa,
                receiverVpa,
                amount: numAmount,
                location
            });
        }

        return { transactions: validTransactions, errorCount };
    } catch (e) {
        throw new Error("Failed to parse CSV file. Ensure it has headers: senderVpa,receiverVpa,amount,location");
    }
}

export async function processBatchTransactions(batchId: string, transactions: any[]) {
    // Process transactions with concurrency limit
    const CONCURRENCY_LIMIT = 10;
    let processedCount = 0;
    let frozenCount = 0;
    let allowedCount = 0;
    const results = [];

    // Helper for batch chunking
    for (let i = 0; i < transactions.length; i += CONCURRENCY_LIMIT) {
        const chunk = transactions.slice(i, i + CONCURRENCY_LIMIT);

        const chunkPromises = chunk.map(async (tx) => {
            try {
                const result = await processTransaction({
                    ...tx,
                    // Pass a flag to indicate batch processing if we want to bypass single alerts
                });

                // Link transaction to batch job
                await prisma.transaction.update({
                    where: { id: result.id },
                    data: { batchId }
                });

                if (result.status === "FROZEN") frozenCount++;
                else allowedCount++;

                processedCount++;
                return result;
            } catch (err) {
                console.error("Batch TX error", err);
                // Treat failures as frozen default
                frozenCount++;
                processedCount++;
                return null;
            }
        });

        const completed = await Promise.all(chunkPromises);
        results.push(...completed.filter(Boolean));

        // Update progress in DB every chunk
        await prisma.batchJob.update({
            where: { id: batchId },
            data: { processedCount, frozenCount, allowedCount }
        });
    }

    return { processedCount, frozenCount, allowedCount, results };
}

export function generateBatchReport(batchData: any, transactions: any[]) {
    const total = batchData.totalCount;
    const frozen = batchData.frozenCount;
    const allowed = batchData.allowedCount;

    const senderRisk: Record<string, number> = {};
    const receiverRisk: Record<string, number> = {};

    let safeCount = 0;
    let moderateCount = 0;
    let highCount = 0;

    const txList = transactions.map(t => {
        const score = Number(t.riskScore) || 0;
        if (score < 0.3) safeCount++;
        else if (score < 0.65) moderateCount++;
        else highCount++;

        if (t.status === 'FROZEN') {
            senderRisk[t.senderVpa] = (senderRisk[t.senderVpa] || 0) + 1;
            receiverRisk[t.receiverVpa] = (receiverRisk[t.receiverVpa] || 0) + 1;
        }

        return {
            rrn: t.rrn,
            sender: t.senderVpa,
            receiver: t.receiverVpa,
            amount: Number(t.amount),
            status: t.status,
            riskScore: score
        };
    });

    const topSenders = Object.entries(senderRisk)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([vpa, count]) => ({ vpa, count }));

    const topReceivers = Object.entries(receiverRisk)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([vpa, count]) => ({ vpa, count }));

    return {
        summary: {
            total,
            frozen,
            allowed,
            frozenPercent: total > 0 ? (frozen / total) * 100 : 0,
            allowedPercent: total > 0 ? (allowed / total) * 100 : 0
        },
        distribution: {
            safe: safeCount,
            moderate: moderateCount,
            high: highCount
        },
        topSenders,
        topReceivers,
        transactions: txList.slice(0, 50) // Top 50 for report limit
    };
}
