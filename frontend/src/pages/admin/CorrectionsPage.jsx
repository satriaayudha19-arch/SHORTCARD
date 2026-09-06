import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError, formatDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default function CorrectionsPage() {
    const [data, setData] = useState(null);
    const [status, setStatus] = useState("ALL");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(null);
    const [note, setNote] = useState("");
    const [processing, setProcessing] = useState(false);

    const load = useCallback(() => {
        const params = new URLSearchParams({ page: String(page), limit: "10" });
        if (status !== "ALL") params.set("status", status);
        api.get(`/admin/corrections?${params}`).then((res) => setData(res.data)).catch((e) => toast.error(formatApiError(e)));
    }, [page, status]);

    useEffect(() => { load(); }, [load]);

    const openDetail = (c) => {
        setSelected(c);
        setNote(c.admin_note || "");
    };

    const process = async (action) => {
        setProcessing(true);
        try {
            await api.patch(`/admin/corrections/${selected.id}`, { action, admin_note: note || undefined });
            toast.success(action === "APPROVE" ? "Koreksi disetujui. Link kartu telah diperbarui." : action === "REJECT" ? "Koreksi ditolak." : "Status diubah menjadi Ditinjau.");
            setSelected(null);
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setProcessing(false);
        }
    };

    const actionable = selected && !["COMPLETED", "REJECTED"].includes(selected.status);

    return (
        <div data-testid="admin-corrections-page">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Koreksi Link</h1>
                    <p className="text-sm text-slate-500 mt-1">Permintaan Lifetime Garansi Link dari pelanggan.</p>
                </div>
                <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                    <SelectTrigger data-testid="corrections-status-filter" className="w-full sm:w-52 bg-white">
                        <SelectValue placeholder="Semua Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                        <SelectItem value="ALL">Semua Status</SelectItem>
                        <SelectItem value="PENDING">Menunggu</SelectItem>
                        <SelectItem value="REVIEWING">Ditinjau</SelectItem>
                        <SelectItem value="COMPLETED">Selesai</SelectItem>
                        <SelectItem value="REJECTED">Ditolak</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                                <th className="px-5 py-4 font-semibold">Kartu</th>
                                <th className="px-5 py-4 font-semibold hidden md:table-cell">Bisnis</th>
                                <th className="px-5 py-4 font-semibold hidden lg:table-cell">Link Baru</th>
                                <th className="px-5 py-4 font-semibold">Status</th>
                                <th className="px-5 py-4 font-semibold text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!data ? (
                                [...Array(3)].map((_, i) => (
                                    <tr key={i} className="border-b border-slate-50"><td colSpan={5} className="px-5 py-4"><Skeleton className="h-5 w-full" /></td></tr>
                                ))
                            ) : data.items.length === 0 ? (
                                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400" data-testid="corrections-empty-state">Tidak ada permintaan koreksi.</td></tr>
                            ) : (
                                data.items.map((c) => (
                                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60" data-testid={`correction-row-${c.id}`}>
                                        <td className="px-5 py-4 font-mono-code font-semibold text-slate-900">{c.card_code}</td>
                                        <td className="px-5 py-4 hidden md:table-cell text-slate-600">{c.business_name}</td>
                                        <td className="px-5 py-4 hidden lg:table-cell text-slate-500 max-w-[220px] truncate">{c.new_url}</td>
                                        <td className="px-5 py-4"><StatusBadge status={c.status} type="correction" /></td>
                                        <td className="px-5 py-4 text-right">
                                            <Button size="sm" variant="outline" data-testid={`correction-detail-${c.id}`} onClick={() => openDetail(c)} className="rounded-full">
                                                <Eye className="w-3.5 h-3.5 mr-1.5" /> Detail
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
                <DialogContent className="bg-white max-h-[90vh] overflow-y-auto" data-testid="correction-detail-dialog">
                    {selected && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-3">
                                    Koreksi <span className="font-mono-code">{selected.card_code}</span>
                                    <StatusBadge status={selected.status} type="correction" />
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2 text-sm">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Bisnis</p><p className="font-semibold">{selected.business_name}</p></div>
                                    <div><p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Diajukan</p><p>{formatDate(selected.created_at)}</p></div>
                                    <div><p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Pemohon</p><p className="font-semibold">{selected.requester_name}</p></div>
                                    <div><p className="text-xs uppercase tracking-wide text-slate-400 mb-1">WhatsApp</p><p>{selected.requester_phone}</p></div>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Alasan</p>
                                    <p className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-slate-700">{selected.reason}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Link Lama</p>
                                    <p className="font-mono-code text-xs text-red-500 break-all bg-red-50 rounded-lg p-3">{selected.old_url || "-"}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Link Baru</p>
                                    <p className="font-mono-code text-xs text-emerald-600 break-all bg-emerald-50 rounded-lg p-3" data-testid="correction-detail-new-url">{selected.new_url}</p>
                                </div>
                                <div>
                                    <Label htmlFor="admin-note">Catatan Internal</Label>
                                    <Textarea id="admin-note" data-testid="correction-admin-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-2" disabled={!actionable} />
                                </div>
                                {actionable && (
                                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                        <Button data-testid="correction-approve-button" onClick={() => process("APPROVE")} disabled={processing} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                                            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Setujui & Perbarui Link</>}
                                        </Button>
                                        {selected.status === "PENDING" && (
                                            <Button data-testid="correction-reviewing-button" variant="outline" onClick={() => process("REVIEWING")} disabled={processing}>
                                                Tandai Ditinjau
                                            </Button>
                                        )}
                                        <Button data-testid="correction-reject-button" variant="outline" onClick={() => process("REJECT")} disabled={processing} className="text-red-600 border-red-300">
                                            <XCircle className="w-4 h-4 mr-2" /> Tolak
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
