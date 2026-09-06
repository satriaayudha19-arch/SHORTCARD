import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
});

api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retried && !original.url.includes("/auth/")) {
            original._retried = true;
            try {
                await api.post("/auth/refresh");
                return api(original);
            } catch (e) {
                // session expired
            }
        }
        return Promise.reject(error);
    }
);

export function formatApiError(error) {
    const detail = error?.response?.data?.detail;
    if (detail == null) return error?.message || "Terjadi kesalahan. Silakan coba lagi.";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
        return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
    }
    if (detail && typeof detail.msg === "string") return detail.msg;
    return String(detail);
}

export function formatDate(isoString) {
    if (!isoString) return "-";
    try {
        return new Date(isoString).toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return isoString;
    }
}

export default api;
