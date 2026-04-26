import app from "./app.js";
import { config } from "./config/index.js";
import prisma from "./services/prisma.service.js";

async function bootstrap(): Promise<void> {
    try {
        // Verify database connectivity
        await prisma.$connect();
        console.log("[FraudShield] ✅ Database connected");

        app.listen(config.port, () => {
            console.log(`[FraudShield] 🛡️  Server running on http://localhost:${config.port}`);
            console.log(`[FraudShield] 🤖 AI engine expected at ${config.aiEngineUrl}`);
        });
    } catch (error) {
        console.error("[FraudShield] ❌ Failed to start server:", error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("\n[FraudShield] Shutting down gracefully...");
    await prisma.$disconnect();
    process.exit(0);
});

bootstrap();
