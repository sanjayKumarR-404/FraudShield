import { Request, Response } from "express";
import prisma from "../services/prisma.service.js";
import { hashPassword, comparePassword, generateToken } from "../services/auth.service.js";
import type { RegisterBody, LoginBody, ApiResponse } from "../types/index.js";

/**
 * POST /api/auth/register
 * Creates a new user account with hashed password and UPI VPA.
 */
export async function register(req: Request, res: Response): Promise<void> {
    const { email, password, upiVpa } = req.body as RegisterBody;

    // --- Input validation ---
    if (!email || !password || !upiVpa) {
        res.status(400).json({ success: false, message: "Fields email, password, and upiVpa are required" } satisfies ApiResponse);
        return;
    }

    if (password.length < 8) {
        res.status(400).json({ success: false, message: "Password must be at least 8 characters" } satisfies ApiResponse);
        return;
    }

    // --- Check for existing user ---
    const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email }, { upiVpa }] },
    });

    if (existingUser) {
        const field = existingUser.email === email ? "email" : "UPI VPA";
        res.status(409).json({ success: false, message: `A user with this ${field} already exists` } satisfies ApiResponse);
        return;
    }

    // --- Create user ---
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
        data: { email, password: hashedPassword, upiVpa },
    });

    const token = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({
        success: true,
        message: "Registration successful",
        data: {
            token,
            user: { id: user.id, email: user.email, upiVpa: user.upiVpa },
        },
    } satisfies ApiResponse);
}

/**
 * POST /api/auth/login
 * Authenticates user credentials and returns a JWT.
 */
export async function login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as LoginBody;

    if (!email || !password) {
        res.status(400).json({ success: false, message: "Fields email and password are required" } satisfies ApiResponse);
        return;
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        res.status(401).json({ success: false, message: "Invalid credentials" } satisfies ApiResponse);
        return;
    }

    const validPassword = await comparePassword(password, user.password);

    if (!validPassword) {
        res.status(401).json({ success: false, message: "Invalid credentials" } satisfies ApiResponse);
        return;
    }

    const token = generateToken({ userId: user.id, email: user.email });

    res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
            token,
            user: { id: user.id, email: user.email, upiVpa: user.upiVpa },
        },
    } satisfies ApiResponse);
}
