import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default function CardsPage() {
    const [data, setData] = useState(null);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("ALL");
    const [page, setPage] = useState(1);
    const [creating, setCreating] = useState(false);
    const [count, setCount] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);

    const load = useCallback(() => {
        const params = new URLSearchParams({ page: String(page), limit: "10" });
        if (search) params.set("search", search);
        if (status !== "ALL") params.set("status", status);
        api.get(`/admin/cards?${params}`).then((res) => setData(res.data)).catch((e) => toast.error(formatApiError(e)));
    }, [page, search, status]);

    useEffect(() => {
        const t = setTimeout(load, 250);
        return () => clearTimeout(t);
    }, [load]);

    const createCards = async () => {
        setCreating(true);
        try {
            const res = await api.post("/admin/cards", { count });
            toast.success(res.data.message);
            setDialogOpen(false);
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setCreating(false);
        }
    };

    return (
        <div data-testid="admin-cards-page">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Kartu</h1>
                    <p className="text-sm text-slate-500 mt-1">Kelola seluruh kartu Short Card.</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button data-testid="cards-create-button" className="rounded-full bg-blue-600 hover:bg-blue-700 font-semibold">
                            <Plus className="w-4 h-4 mr-2" /> Buat Kartu
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white">
                        <DialogHeader>
                            <DialogTitle>Buat Kartu Baru</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div>
                                <Label htmlFor="card-count">Jumlah kartu (status: Belum Digunakan)</Label>
                                <Input
                                    id="card-count"
                                    data-testid="cards-create-count-input"
                                    type="number"
                                    min={1}
                                    max={500}
                                    value={count}
                                    onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                                    className="mt-2"
                                />
                                <p className="text-xs text-slate-500 mt-2">Kode kartu dibuat otomatis dan unik (SC-XXXX).</p>
                            </div>
                            <Button data-testid="cards-create-submit-button" onClick={createCards} disabled={creating} className="w-full bg-blue-600 hover:bg-blue-700">
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buat Kartu"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                        data-testid="cards-search-input"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Cari kode kartu (SC-...)"
                        className="pl-10 bg-white"
                    />
                </div>
                <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                    <SelectTrigger data-testid="cards-status-filter" className="w-full sm:w-52 bg-white">
                        <SelectValue placeholder="Semua Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                        <SelectItem value="ALL">Semua Status</SelectItem>
                        <SelectItem value="ACTIVE">Aktif</SelectItem>
                        <SelectItem value="ASSIGNED">Diberikan</SelectItem>
                        <SelectItem value="UNASSIGNED">Belum Digunakan</SelectItem>
                        <SelectItem value="DISABLED">Nonaktif</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                                <th className="px-5 py-4 font-semibold">Kode</th>
                                <th className="px-5 py-4 font-semibold">Status</th>
                                <th className="px-5 py-4 font-semibold hidden md:table-cell">Bisnis</th>
                                <th className="px-5 py-4 font-semibold hidden lg:table-cell">Tujuan</th>
                                <th className="px-5 py-4 font-semibold text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!data ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="border-b border-slate-50">
                                        <td colSpan={5} className="px-5 py-4"><Skeleton className="h-5 w-full" /></td>
                                    </tr>
                                ))
                            ) : data.items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-12 text-center text-slate-400" data-testid="cards-empty-state">
                                        Tidak ada kartu ditemukan.
                                    </td>
                                </tr>
                            ) : (
                                data.items.map((card) => (
                                    <tr key={card.id} className="border-b border-slate-50 hover:bg-slate-50/60" data-testid={`card-row-${card.code}`}>
                                        <td className="px-5 py-4 font-mono-code font-semibold text-slate-900">{card.code}</td>
                                        <td className="px-5 py-4"><StatusBadge status={card.status} /></td>
                                        <td className="px-5 py-4 hidden md:table-cell text-slate-600">{card.business_name || "-"}</td>
                                        <td className="px-5 py-4 hidden lg:table-cell text-slate-500 max-w-[220px] truncate">{card.destination_url || "-"}</td>
                                        <td className="px-5 py-4 text-right">
                                            <Link to={`/admin/cards/${card.code}`}>
                                                <Button size="sm" variant="outline" data-testid={`card-detail-button-${card.code}`} className="rounded-full">
                                                    Detail
                                                </Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {data && data.pages > 1 && (
                    <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
                        <p className="text-xs text-slate-500">Halaman {data.page} dari {data.pages} · {data.total} kartu</p>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" data-testid="cards-prev-page" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" data-testid="cards-next-page" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
