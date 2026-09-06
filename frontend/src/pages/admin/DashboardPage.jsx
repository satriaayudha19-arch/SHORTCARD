import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, CheckCircle2, CircleDashed, Ban, Building2, FileEdit, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDate } from "@/lib/api";

const STAT_CARDS = [
    { key: "total_cards", label: "Total Kartu", icon: CreditCard, color: "text-blue-600 bg-blue-50" },
    { key: "active_cards", label: "Kartu Aktif", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
    { key: "unassigned_cards", label: "Belum Digunakan", icon: CircleDashed, color: "text-amber-600 bg-amber-50" },
    { key: "disabled_cards", label: "Nonaktif", icon: Ban, color: "text-red-600 bg-red-50" },
    { key: "total_businesses", label: "Total Bisnis", icon: Building2, color: "text-indigo-600 bg-indigo-50" },
    { key: "pending_corrections", label: "Koreksi Pending", icon: FileEdit, color: "text-violet-600 bg-violet-50" },
];

export default function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [recent, setRecent] = useState([]);

    useEffect(() => {
        api.get("/admin/stats").then((res) => setStats(res.data)).catch(() => {});
        api.get("/admin/corrections?status=PENDING&limit=5").then((res) => setRecent(res.data.items)).catch(() => {});
    }, []);

    return (
        <div data-testid="admin-dashboard">
            <div className="mb-8">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
                <p className="text-sm text-slate-500 mt-1">Ringkasan platform Short Card.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10" data-testid="dashboard-stats">
                {STAT_CARDS.map((s) => (
                    <div key={s.key} className="bg-white rounded-2xl border border-slate-200 p-5" data-testid={`stat-${s.key.replace(/_/g, "-")}`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                                <s.icon className="w-5 h-5" />
                            </span>
                        </div>
                        {stats ? (
                            <p className="text-3xl font-extrabold text-slate-900">{stats[s.key]}</p>
                        ) : (
                            <Skeleton className="h-9 w-16" />
                        )}
                        <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wide">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="font-bold text-slate-900">Koreksi Link Terbaru</h2>
                    <Link to="/admin/corrections" data-testid="dashboard-view-corrections-link" className="text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                        Lihat Semua <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
                {recent.length === 0 ? (
                    <p className="text-sm text-slate-400 py-6 text-center" data-testid="dashboard-no-corrections">Tidak ada koreksi yang menunggu.</p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {recent.map((c) => (
                            <li key={c.id} className="py-3 flex items-center justify-between gap-4" data-testid={`dashboard-correction-${c.id}`}>
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-900 text-sm">
                                        <span className="font-mono-code">{c.card_code}</span> · {c.business_name}
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">{c.new_url}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-xs text-slate-400 hidden sm:block">{formatDate(c.created_at)}</span>
                                    <StatusBadge status={c.status} type="correction" />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
