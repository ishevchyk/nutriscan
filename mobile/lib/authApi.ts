// Bare instance used for auth endpoints (no auth/refresh interceptors - avoids infinite refresh loops).
// Logging interceptors are safe to add here since they have no side effects / don't call authApi again.
import axios from "axios";
import {API_BASE_URL} from "../constants/env";
import {logApiError, logApiRequest, logApiResponse} from "../utils/debugLogger";

export const authApi = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

authApi.interceptors.request.use((config) => {
    logApiRequest(config);
    return config;
});

authApi.interceptors.response.use(
    (response) => {
        logApiResponse(response);
        return response;
    },
    (error) => {
        logApiError(error);
        return Promise.reject(error);
    }
);