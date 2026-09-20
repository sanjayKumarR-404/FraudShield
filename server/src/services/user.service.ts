import prisma from './prisma.service.js';
import bcryptjs from 'bcryptjs';

/**
 * Get or create a user by VPA.
 * If user doesn't exist, create a minimal user record.
 */
export async function getOrCreateUser(vpa: string, email?: string) {
    try {
        // Try to find existing user
        let user = await prisma.user.findUnique({
            where: { upiVpa: vpa }
        });

        if (user) {
            return user;
        }

        // User doesn't exist, create one
        const placeholderEmail = email || `${vpa.replace('@', '.')}.mock@fraudshield.local`;
        const hashedPassword = await bcryptjs.hash(vpa + Date.now(), 10);

        user = await prisma.user.create({
            data: {
                upiVpa: vpa,
                email: placeholderEmail,
                password: hashedPassword
            }
        });

        console.log(`[FraudShield] Auto-created user: ${vpa}`);
        return user;
    } catch (error: any) {
        // If user creation fails (e.g., email already exists), try to find again
        console.error(`[FraudShield] Error in getOrCreateUser:`, error.message);
        const user = await prisma.user.findUnique({
            where: { upiVpa: vpa }
        });
        if (user) return user;
        throw error;
    }
}
