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

export interface AttributionComponent {
    weight: number;
    value: number;
    contribution: number;
    reason: string;
}

export interface FeatureAttribution {
    gnn: AttributionComponent;
    location: AttributionComponent;
    amount: AttributionComponent;
    velocity: AttributionComponent;
    behavioral: AttributionComponent;
}

export interface AIEngineResponse {
    status: string;
    action: string;
    reason: string;
    riskScore: number;
    attribution?: FeatureAttribution;
}

// --- API Response Types ---

export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
}
