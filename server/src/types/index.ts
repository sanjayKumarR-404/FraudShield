import { Request } from "express";

// --- Auth Types ---

export interface RegisterBody {
    email: string;
    password: string;
    upiVpa: string;
}

export interface LoginBody {
    email: string;
    password: string;
}

export interface JwtPayload {
    userId: string;
    email: string;
}

export interface AuthenticatedRequest extends Request {
    userId?: string;
}

// --- Transaction Types ---

export interface TransactionBody {
    senderVpa: string;
    receiverVpa: string;
    amount: number;
    location: string;
}

export interface AIEngineRequest {
    amount: number;
    senderVpa: string;
    receiverVpa: string;
    location: string;
    timestamp: string;
}

export interface AIEngineResponse {
    status: "High Risk" | "Safe";
    action: "Freeze" | "Allow";
    reason: string;
    riskScore: number;
}

// --- API Response Types ---

export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
}
