import prisma from "./prisma.service.js";

export async function initializeOrUpdateProfile(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    // Fetch last 100 transactions
    const transactions = await prisma.transaction.findMany({
        where: { senderVpa: user.upiVpa },
        orderBy: { timestamp: 'desc' },
        take: 100
    });

    if (transactions.length === 0) return;

    const amounts = transactions.map(t => Number(t.amount));
    const totalAmount = amounts.reduce((a, b) => a + b, 0);
    const avgTransactionAmount = totalAmount / amounts.length;

    const minTransactionAmount = Math.min(...amounts);
    const maxTransactionAmount = Math.max(...amounts);

    // StdDev
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - avgTransactionAmount, 2), 0) / amounts.length;
    const stdDevAmount = Math.sqrt(variance);

    // Hours calculation
    const hoursCount: Record<number, number> = {};
    let nightTxnCount = 0;

    const receiversCount: Record<string, number> = {};
    const locationsCount: Record<string, number> = {};

    transactions.forEach(t => {
        const d = new Date(t.timestamp);
        const hour = d.getHours();
        hoursCount[hour] = (hoursCount[hour] || 0) + 1;
        if (hour >= 0 && hour < 6) nightTxnCount++;

        receiversCount[t.receiverVpa] = (receiversCount[t.receiverVpa] || 0) + 1;
        locationsCount[t.location] = (locationsCount[t.location] || 0) + 1;
    });

    const mostCommonHour = parseInt(Object.keys(hoursCount).reduce((a, b) => hoursCount[parseInt(a)] > hoursCount[parseInt(b)] ? a : b));
    const nightTransactionRatio = nightTxnCount / transactions.length;

    const favoriteReceiverVpas = Object.entries(receiversCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
    const favoriteLocations = Object.entries(locationsCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);

    await prisma.userProfile.upsert({
        where: { userId },
        create: {
            userId,
            avgTransactionAmount,
            minTransactionAmount,
            maxTransactionAmount,
            stdDevAmount,
            mostCommonHour,
            nightTransactionRatio,
            favoriteReceiverVpas,
            favoriteLocations,
            transactionsProcessed: transactions.length
        },
        update: {
            avgTransactionAmount,
            minTransactionAmount,
            maxTransactionAmount,
            stdDevAmount,
            mostCommonHour,
            nightTransactionRatio,
            favoriteReceiverVpas,
            favoriteLocations,
            transactionsProcessed: transactions.length
        }
    });
}

export async function getUserProfile(userId: string) {
    return prisma.userProfile.findUnique({ where: { userId } });
}

export async function isTransactionAnomalous(userId: string, transaction: any) {
    const profile = await getUserProfile(userId);
    if (!profile) return { isAnomalous: false, anomalousFactors: [] };
    if (profile.transactionsProcessed < 10) return { isAnomalous: false, anomalousFactors: [] };

    const numAmount = Number(transaction.amount);
    const factors: string[] = [];

    // Amount Z-Score
    const upperLimit = profile.avgTransactionAmount + (profile.amountZscoreThreshold * profile.stdDevAmount);
    if (numAmount > upperLimit) {
        factors.push(`Unusual Amount: ₹${numAmount.toLocaleString()} vs Avg ₹${profile.avgTransactionAmount.toFixed(2)}`);
    }

    // Time pattern
    const d = new Date(transaction.timestamp);
    const h = d.getHours();
    if (h >= 0 && h < 6 && profile.nightTransactionRatio < 0.1) {
        factors.push(`Unusual Time: ${h}AM vs typical operations`);
    }

    // Known behavior
    if (!profile.favoriteReceiverVpas.includes(transaction.receiverVpa)) {
        factors.push(`Unknown Receiver: Not in top established contacts`);
    }

    if (!profile.favoriteLocations.includes(transaction.location) && profile.favoriteLocations.length > 0) {
        factors.push(`Unusual Location: Not in standard operating zones`);
    }

    // Velocity threshold
    const recentTxnsCount = await prisma.transaction.count({
        where: {
            senderVpa: transaction.senderVpa,
            timestamp: {
                gte: new Date(new Date(transaction.timestamp).getTime() - 60000)
            }
        }
    });

    if (recentTxnsCount > profile.velocityThreshold) {
        factors.push(`Abnormal Velocity: ${recentTxnsCount} txns in 60 seconds`);
    }

    return {
        isAnomalous: factors.length > 0,
        anomalousFactors: factors
    };
}
