import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const client = axios.create({
    baseURL: API_URL,
});

client.interceptors.request.use((config) => {
    const token = localStorage.getItem('fraudshield_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => Promise.reject(error));

client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('fraudshield_token');
            if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export const registerUser = async (email: string, password: string, upiVpa: string) => {
    return client.post('/api/auth/register', { email, password, upiVpa });
};

export const loginUser = async (email: string, password: string) => {
    const response = await client.post('/api/auth/login', { email, password });
    const token = response.data?.data?.token;
    if (token) {
        localStorage.setItem('fraudshield_token', token);
    }
    return response.data;
};

export const processTransaction = async (senderVpa: string, receiverVpa: string, amount: number, location: string) => {
    const response = await client.post('/api/transactions/process', {
        senderVpa,
        receiverVpa,
        amount,
        location
    });
    return response.data?.data || {};
};

export const getAllTransactions = async () => {
    const response = await client.get('/api/transactions');
    return response.data?.data || [];
};

export const getTransactionById = async (id: string) => {
    return client.get(`/api/transactions/${id}`);
};

export const initiateRecovery = async (transactionId: string, complainantName: string, complainantEmail: string, complainantVpa: string, amountDisputed: number) => {
    const response = await client.post('/api/recovery/initiate', { transactionId, complainantName, complainantEmail, complainantVpa, amountDisputed });
    return response.data?.data || {};
};

export const advanceRecovery = async (caseId: string) => {
    const response = await client.patch(`/api/recovery/${caseId}/advance`);
    return response.data?.data || {};
};

export const getAllRecoveryCases = async () => {
    const response = await client.get('/api/recovery');
    return response.data?.data || [];
};

export const getRecoveryByTransaction = async (transactionId: string) => {
    const response = await client.get(`/api/recovery/transaction/${transactionId}`);
    return response.data?.data || null;
};

export const getUserProfile = async (userId: string) => {
    const response = await client.get(`/api/users/${userId}/profile`);
    return response.data?.data || null;
};

// --- Batch APIs ---
export const uploadBatchFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await client.post('/api/batches', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data.data;
};

export const getBatchStatus = async (batchId: string) => {
    const res = await client.get(`/api/batches/${batchId}`);
    return res.data.data;
};

export const getAllBatches = async () => {
    const res = await client.get('/api/batches');
    return res.data.data;
};

export const downloadBatchReportCsv = async (batchId: string) => {
    const token = localStorage.getItem('fraudshield_token');
    const response = await fetch(`${API_URL}/api/batches/${batchId}/report/csv`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to download CSV');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_report_${batchId}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

export const downloadBatchReportPdf = async (batchId: string) => {
    const token = localStorage.getItem('fraudshield_token');
    const response = await fetch(`${API_URL}/api/batches/${batchId}/report/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to download PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_report_${batchId}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

export const downloadRecoveryPdf = async (caseId: string) => {
    const token = localStorage.getItem('fraudshield_token');
    const response = await fetch(`${API_URL}/api/recovery/${caseId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to download Recovery PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recovery_case_${caseId}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

export default client;
