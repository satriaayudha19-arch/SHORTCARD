import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { API_BASE } from "@/lib/api";
import { Nfc } from "lucide-react";

export default function RedirectPage() {
    const { code } = useParams();

    useEffect(() => {
        if (code) {
            window.location.replace(`${API_BASE}/r/${encodeURIComponent(code)}`);
        }
    }, [code]);

    return (
        <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col items-center justify-center px-6 text-center">
            <span className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mb-6 animate-pulse">
                <Nfc className="w-7 h-7 text-white" />
            </span>
            <p className="text-xs tracking-[0.3em] uppercase text-slate-500 mb-3">Short Card · {code}</p>
            <h1 className="text-2xl font-bold" data-testid="redirect-loading-title">Mengalihkan...</h1>
            <p className="text-slate-400 mt-2 text-sm">Anda sedang diarahkan ke tujuan kartu ini.</p>
        </div>
    );
}
