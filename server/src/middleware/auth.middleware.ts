import { Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.service.js";
import type { AuthenticatedRequest } from "../types/index.js";

/**
 * JWT authentication guard.
 * Extracts the Bearer token from the Authorization header, verifies it,
 * and attaches the userId to the request object for downstream handlers.
 */
export function authGuard(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ success: false, message: "Missing or malformed authorization header" });
        return;
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = verifyToken(token);
        req.userId = decoded.userId;
        next();
    } catch {
        res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
}
