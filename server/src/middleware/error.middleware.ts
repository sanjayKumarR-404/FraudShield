import { Request, Response, NextFunction } from "express";

/**
 * Global error handler. Catches unhandled errors and returns a structured JSON response.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
    console.error(`[FraudShield Error] ${err.message}`, err.stack);

    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal server error",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
}
