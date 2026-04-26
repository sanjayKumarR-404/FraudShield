import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import type { JwtPayload } from "../types/index.js";

/**
 * Hash a plaintext password using bcrypt.
 */
export async function hashPassword(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, config.bcryptSaltRounds);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 */
export async function comparePassword(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
}

/**
 * Sign a JWT containing user identity claims.
 */
export function generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/**
 * Verify and decode a JWT. Returns the decoded payload or throws on invalid/expired tokens.
 */
export function verifyToken(token: string): JwtPayload {
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
