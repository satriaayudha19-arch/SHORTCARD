import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Nfc, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLogin() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || "/admin";
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (user) navigate(from, { replace: true });
    }, [user, navigate, from]);

    if (user) return null;

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await login(email, password);
            toast.success("Selamat datang kembali!");
            navigate(from, { replace: true });
        } catch (err) {
            setError(formatApiError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center px-4" data-testid="admin-login-page">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <span className="inline-flex w-14 h-14 rounded-2xl bg-blue-600 items-center justify-center mb-4">
                        <Nfc className="w-7 h-7 text-white" />
                    </span>
                    <h1 className="text-2xl font-extrabold text-slate-50 tracking-tight">Short Card Admin</h1>
                    <p className="text-sm text-slate-500 mt-1">GlobalConnex Management System</p>
                </div>
                <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-[#131B2A] p-6 space-y-4" data-testid="admin-login-form">
                    {error && (
                        <div data-testid="admin-login-error" className="rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 text-sm px-4 py-3">
                            {error}
                        </div>
                    )}
                    <div>
                        <Label htmlFor="admin-email" className="text-slate-300">Email</Label>
                        <Input
                            id="admin-email"
                            data-testid="admin-email-input"
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-2 h-12 bg-[#0B0F17] border-slate-700 text-slate-100"
                        />
                    </div>
                    <div>
                        <Label htmlFor="admin-password" className="text-slate-300">Kata Sandi</Label>
                        <Input
                            id="admin-password"
                            data-testid="admin-password-input"
                            type="password"
                            required
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-2 h-12 bg-[#0B0F17] border-slate-700 text-slate-100"
                        />
                    </div>
                    <Button
                        type="submit"
                        data-testid="admin-login-submit-button"
                        disabled={loading}
                        className="w-full h-12 rounded-full bg-blue-600 hover:bg-blue-500 font-bold"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Masuk"}
                    </Button>
                </form>
                <p className="text-center text-xs text-slate-600 mt-6">
                    <a href="/" className="hover:text-slate-400 transition-colors">← Kembali ke Short Card</a>
                </p>
            </div>
        </div>
    );
}
