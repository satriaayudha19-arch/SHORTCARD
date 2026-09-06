import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    // null = checking, false = not authenticated, object = admin user
    const [user, setUser] = useState(null);

    useEffect(() => {
        api.get("/auth/me")
            .then((res) => setUser(res.data))
            .catch(() => setUser(false));
    }, []);

    const login = useCallback(async (email, password) => {
        const res = await api.post("/auth/login", { email, password });
        setUser(res.data);
        return res.data;
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.post("/auth/logout");
        } finally {
            setUser(false);
        }
    }, []);

    return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
