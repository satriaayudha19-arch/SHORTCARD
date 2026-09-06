import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError, formatDate } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryPage() {
    const [data, setData] = useState(null);

    useEffect(() => {
        api.get("/admin/history?limit=50").then((res) => setData(res.data)).catch((e) => toast.error(formatApiError(e)));
    }, []);

    return (
        <div data-testid="admin-history-page">
            <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Riwayat Perubahan</h1>
                <p className="text-sm text-slate-500 mt-1">Audit trail seluruh perubahan destination URL kartu.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                                <th className="px-5 py-4 font-semibold">Waktu</th>
                                <th className="px-5 py-4 font-semibold">Kartu</th>
                                <th className="px-5 py-4 font-semibold hidden md:table-cell">Perubahan</th>
                                <th className="px-5 py-4 font-semibold hidden lg:table-cell">Oleh</th>
                                <th className="px-5 py-4 font-semibold hidden lg:table-cell">Alasan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!data ? (
                                [...Array(4)].map((_, i) => (
                                    <tr key={i} className="border-b border-slate-50"><td colSpan={5} className="px-5 py-4"><Skeleton className="h-5 w-full" /></td></tr>
                                ))
                            ) : data.items.length === 0 ? (
                                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400" data-testid="history-empty-state">Belum ada riwayat.</td></tr>
                            ) : (
                                data.items.map((h) => (
                                    <tr key={h.id} className="border-b border-slate-50" data-testid={`history-row-${h.id}`}>
                                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap text-xs">{formatDate(h.created_at)}</td>
                                        <td className="px-5 py-4">
                                            <Link to={`/admin/cards/${h.card_code}`} className="font-mono-code font-semibold text-blue-600 hover:underline">{h.card_code}</Link>
                                        </td>
                                        <td className="px-5 py-4 hidden md:table-cell max-w-[280px]">
                                            {h.old_url && <p className="text-xs font-mono-code text-red-500 line-through truncate">{h.old_url}</p>}
                                            <p className="text-xs font-mono-code text-emerald-600 truncate">{h.new_url}</p>
                                        </td>
                                        <td className="px-5 py-4 hidden lg:table-cell text-slate-600 text-xs">{h.changed_by}</td>
                                        <td className="px-5 py-4 hidden lg:table-cell text-slate-500 text-xs max-w-[200px] truncate">{h.reason}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
