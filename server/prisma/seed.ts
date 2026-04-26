import { PrismaClient, TransactionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// --- Seed Data Constants ---

const CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata", "Ahmedabad"];
const SUSPICIOUS_CITIES = ["Unknown-Region", "VPN-Location", "Proxy-Server", "Offshore-Zone", "Dark-Net"];

const TEST_USERS = [
    { email: "alice@fraudshield.dev", password: "password123", upiVpa: "alice@upi" },
    { email: "bob@fraudshield.dev", password: "password123", upiVpa: "bob@upi" },
    { email: "charlie@fraudshield.dev", password: "password123", upiVpa: "charlie@upi" },
    { email: "diana@fraudshield.dev", password: "password123", upiVpa: "diana@upi" },
    { email: "eve@fraudshield.dev", password: "password123", upiVpa: "eve@upi" },
];

function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateRRN(): string {
    return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
}

function randomAmount(min: number, max: number): number {
    return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

/**
 * Generate a timestamp within the last 30 days.
 * Fraud transactions cluster within tight windows to simulate rapid-fire patterns.
 */
function randomTimestamp(isFraud: boolean): Date {
    const now = Date.now();
    if (isFraud) {
        // Fraud: within the last 2 hours (rapid-fire)
        return new Date(now - Math.random() * 2 * 60 * 60 * 1000);
    }
    // Normal: spread across the last 30 days
    return new Date(now - Math.random() * 30 * 24 * 60 * 60 * 1000);
}

async function seed(): Promise<void> {
    console.log("[Seed] 🌱 Starting FraudShield data seeding...\n");

    // --- Clean existing data ---
    await prisma.transaction.deleteMany();
    await prisma.user.deleteMany();
    console.log("[Seed] 🗑️  Cleared existing data");

    // --- Create users ---
    const hashedPassword = await bcrypt.hash("password123", 12);
    const users = await Promise.all(
        TEST_USERS.map((u) =>
            prisma.user.create({
                data: { email: u.email, password: hashedPassword, upiVpa: u.upiVpa },
            })
        )
    );
    console.log(`[Seed] 👥 Created ${users.length} test users`);

    const vpas = users.map((u) => u.upiVpa);
    const transactions = [];

    // --- Generate 35 normal transactions ---
    for (let i = 0; i < 35; i++) {
        let sender = randomElement(vpas);
        let receiver = randomElement(vpas);
        while (receiver === sender) receiver = randomElement(vpas);

        transactions.push({
            senderVpa: sender,
            receiverVpa: receiver,
            amount: randomAmount(50, 5000),
            rrn: generateRRN(),
            status: TransactionStatus.SUCCESS,
            isFraud: false,
            location: randomElement(CITIES),
            riskScore: randomAmount(0, 25),
            reason: "Transaction within normal parameters",
            timestamp: randomTimestamp(false),
        });
    }

    // --- Generate 15 fraudulent transactions ---
    for (let i = 0; i < 15; i++) {
        let sender = randomElement(vpas);
        let receiver = randomElement(vpas);
        while (receiver === sender) receiver = randomElement(vpas);

        const fraudPatterns = [
            { amount: randomAmount(50000, 500000), location: randomElement(SUSPICIOUS_CITIES), reason: "Unusually high amount from unknown location" },
            { amount: randomAmount(80000, 200000), location: randomElement(CITIES), reason: "Abnormally high amount — potential account takeover" },
            { amount: randomAmount(100000, 300000), location: randomElement(SUSPICIOUS_CITIES), reason: "High-value transfer to suspicious location" },
        ];

        const pattern = randomElement(fraudPatterns);

        transactions.push({
            senderVpa: sender,
            receiverVpa: receiver,
            amount: pattern.amount,
            rrn: generateRRN(),
            status: TransactionStatus.FROZEN,
            isFraud: true,
            location: pattern.location,
            riskScore: randomAmount(55, 100),
            reason: pattern.reason,
            timestamp: randomTimestamp(true),
        });
    }

    // Bulk insert all transactions
    const result = await prisma.transaction.createMany({ data: transactions });
    console.log(`[Seed] 💳 Created ${result.count} transactions (35 normal, 15 fraudulent)`);

    // --- Summary ---
    const frozenCount = await prisma.transaction.count({ where: { status: TransactionStatus.FROZEN } });
    const successCount = await prisma.transaction.count({ where: { status: TransactionStatus.SUCCESS } });

    console.log("\n[Seed] 📊 Summary:");
    console.log(`  ├── Users:              ${users.length}`);
    console.log(`  ├── Total Transactions: ${result.count}`);
    console.log(`  ├── SUCCESS:            ${successCount}`);
    console.log(`  └── FROZEN:             ${frozenCount}`);
    console.log("\n[Seed] ✅ Seeding complete!");
}

seed()
    .catch((e) => {
        console.error("[Seed] ❌ Seeding failed:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
