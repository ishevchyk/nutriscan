// Bare instance used for auth endpoints (no interceptors - avoids infinite refresh loops)
import axios from "axios";
import {API_BASE_URL} from "../constants/env";

export const authApi = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});