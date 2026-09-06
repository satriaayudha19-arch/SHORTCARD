import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Download, Pencil, Ban, CheckCircle2, Loader2, Nfc } from "lucide-react";
import { toast } from "sonner";
import api, { API_BASE, formatApiError, formatDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/admin/StatusBadge";

const DEST_TYPES = ["GOOGLE_REVIEW", "INSTAGRAM", "TIKTOK", "YOUTUBE", "FACEBOOK", "WHATSAPP", "CUSTOM"];

export default function CardDetailPage() {
    const { code } = useParams();
    const [card, setCard] = useState(null);
    const [error, setError] = useState("");
    const [editOpen, setEditOpen] = useState(false);
    const [editType, setEditType] = useState("");
    const [editUrl, setEditUrl] = useState("");
    const [editReason, setEditReason] = useState("");
    const [saving, setSaving] = useState(false);
    const [businesses, setBusinesses] = useState([]);

    const load = useCallback(() => {
        api.get(`/admin/cards/${code}`)
            .then((res) => {
                setCard(res.data);
                setEditType(res.data.destination_type || "CUSTOM");
                setEditUrl(res.data.destination_url || "");
            })
            .catch((e) => setError(formatApiError(e)));
    }, [code]);

    useEffect(() => {
        load();
        api.get("/admin/businesses?limit=100").then((res) => setBusinesses(res.data.items)).catch(() => {});
    }, [load]);

    const copyUrl = () => {
        navigator.clipboard.writeText(card.public_url);
        toast.success("URL publik disalin!");
    };

    const saveDestination = async () => {
        setSaving(true);
        try {
            await api.patch(`/admin/cards/${code}`, {
                destination_type: editType,
                destination_url: editUrl,
                reason: editReason || undefined,
                status: card.status === "ACTIVE" ? undefined : "ACTIVE",
            });
            toast.success("Tujuan kartu diperbarui.");
            setEditOpen(false);
            setEditReason("");
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async () => {
        try {
            const endpoint = card.status === "DISABLED" ? "enable" : "disable";
            const res = await api.post(`/admin/cards/${code}/${endpoint}`);
            toast.success(res.data.message);
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const assignBusiness = async (businessId) => {
        try {
            await api.patch(`/admin/cards/${code}`, { business_id: businessId === "NONE" ? "" : businessId });
            toast.success("Penetapan bisnis diperbarui.");
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    if (error) {
        return (
            <div className="text-center py-20" data-testid="card-detail-error">
                <p className="text-slate-500 mb-4">{error}</p>
                <Link to="/admin/cards"><Button variant="outline">Kembali ke Daftar Kartu</Button></Link>
            </div>
        );
    }

    if (!card) {
        return (
            <div className="space-y-4" data-testid="card-detail-loading">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div data-testid="admin-card-detail">
            <Link to="/admin/cards" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 mb-5">
                <ArrowLeft className="w-4 h-4" /> Kembali
            </Link>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono-code" data-testid="card-detail-code">{card.code}</h1>
                    <div className="mt-2"><StatusBadge status={card.status} testid="card-detail-status" /></div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Dialog open={editOpen} onOpenChange={setEditOpen}>
                        <DialogTrigger asChild>
                            <Button data-testid="card-edit-destination-button" className="rounded-full bg-blue-600 hover:bg-blue-700">
                                <Pencil className="w-4 h-4 mr-2" /> Ubah Tujuan
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-white" aria-describedby="card-edit-desc">
                            <DialogHeader><DialogTitle>Ubah Tujuan Kartu {card.code}</DialogTitle></DialogHeader>
                            <p id="card-edit-desc" className="text-xs text-slate-500">Perubahan langsung mengubah tujuan redirect URL publik kartu. Riwayat perubahan dicatat.</p>
                            <div className="space-y-4 pt-2">
                                <div>
                                    <Label>Jenis Tujuan</Label>
                                    <Select value={editType} onValueChange={setEditType}>
                                        <SelectTrigger data-testid="card-edit-type-select" className="mt-2 bg-white"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-white">
                                            {DEST_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="edit-url">URL Tujuan Baru</Label>
                                    <Input id="edit-url" data-testid="card-edit-url-input" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://..." className="mt-2" />
                                </div>
                                <div>
                                    <Label htmlFor="edit-reason">Alasan Perubahan</Label>
                                    <Input id="edit-reason" data-testid="card-edit-reason-input" value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Opsional" className="mt-2" />
                                </div>
                                <Button data-testid="card-edit-save-button" onClick={saveDestination} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Perubahan"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="outline"
                                data-testid="card-toggle-status-button"
                                className={`rounded-full ${card.status === "DISABLED" ? "text-emerald-600 border-emerald-300" : "text-red-600 border-red-300"}`}
                            >
                                {card.status === "DISABLED" ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Aktifkan</> : <><Ban className="w-4 h-4 mr-2" /> Nonaktifkan</>}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-white">
                            <AlertDialogHeader>
                                <AlertDialogTitle>{card.status === "DISABLED" ? "Aktifkan kembali kartu ini?" : "Nonaktifkan kartu ini?"}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {card.status === "DISABLED"
                                        ? "Kartu akan kembali dapat digunakan sesuai kondisi terakhirnya."
                                        : "URL publik kartu tidak akan melakukan redirect selama kartu nonaktif. Pelanggan akan melihat halaman 'Kartu Tidak Aktif'."}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel data-testid="card-toggle-cancel">Batal</AlertDialogCancel>
                                <AlertDialogAction data-testid="card-toggle-confirm" onClick={toggleStatus}>Ya, Lanjutkan</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* QR + Public URL */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
                    <h2 className="font-bold text-slate-900 mb-4 text-left">QR Code &amp; URL Publik</h2>
                    <div className="inline-block border border-slate-200 rounded-xl p-3 mb-4">
                        <img src={`${API_BASE}/public/cards/${card.code}/qr.png`} alt={`QR ${card.code}`} className="w-40 h-40" data-testid="card-detail-qr" />
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full pl-4 pr-1.5 py-1.5 mb-4">
                        <span className="font-mono-code text-xs text-slate-600 truncate flex-1 text-left" data-testid="card-detail-public-url">{card.public_url}</span>
                        <Button size="sm" variant="ghost" data-testid="card-copy-url-button" onClick={copyUrl} className="rounded-full text-slate-700 hover:text-blue-700 hover:bg-blue-50" aria-label="Salin URL publik">
                            <Copy className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <a href={`${API_BASE}/public/cards/${card.code}/qr.png?download=true`} data-testid="card-download-png">
                            <Button variant="outline" size="sm" className="w-full rounded-full"><Download className="w-3.5 h-3.5 mr-1.5" /> PNG</Button>
                        </a>
                        <a href={`${API_BASE}/public/cards/${card.code}/qr.svg?download=true`} data-testid="card-download-svg">
                            <Button variant="outline" size="sm" className="w-full rounded-full"><Download className="w-3.5 h-3.5 mr-1.5" /> SVG</Button>
                        </a>
                    </div>
                    <div className="mt-5 rounded-xl bg-slate-50 border border-slate-200 p-4 text-left">
                        <p className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1"><Nfc className="w-4 h-4 text-blue-600" /> Konfigurasi NFC</p>
                        <p className="text-xs text-slate-500 leading-relaxed">Tulis URL publik di atas ke chip NFC kartu. Jangan tulis URL tujuan langsung.</p>
                    </div>
                </div>

                {/* Info */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h2 className="font-bold text-slate-900 mb-4">Informasi Kartu</h2>
                    <dl className="space-y-4 text-sm">
                        <div><dt className="text-xs uppercase tracking-wide text-slate-400 mb-1">Jenis Tujuan</dt><dd className="font-semibold text-slate-900" data-testid="card-detail-dest-type">{card.destination_type || "-"}</dd></div>
                        <div><dt className="text-xs uppercase tracking-wide text-slate-400 mb-1">URL Tujuan</dt><dd className="font-mono-code text-xs text-blue-700 break-all" data-testid="card-detail-dest-url">{card.destination_url || "Belum dikonfigurasi"}</dd></div>
                        <div>
                            <dt className="text-xs uppercase tracking-wide text-slate-400 mb-1">Bisnis</dt>
                            <dd data-testid="card-detail-business">
                                <Select value={card.business_id || "NONE"} onValueChange={assignBusiness}>
                                    <SelectTrigger data-testid="card-assign-business-select" className="bg-white h-9 text-sm">
                                        <SelectValue placeholder="Pilih bisnis..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="NONE">— Tidak ada —</SelectItem>
                                        {card.business_id && !businesses.some((b) => b.id === card.business_id) && card.business && (
                                            <SelectItem value={card.business_id}>{card.business.name}</SelectItem>
                                        )}
                                        {businesses.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </dd>
                        </div>
                        {card.business && (
                            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1.5 text-xs text-slate-600">
                                <p className="font-bold text-slate-900 text-sm">{card.business.name}</p>
                                {card.business.owner_name && <p>Pemilik: {card.business.owner_name}</p>}
                                {card.business.whatsapp && <p>WA: {card.business.whatsapp}</p>}
                                {card.business.email && <p>Email: {card.business.email}</p>}
                                {card.business.address && <p>Alamat: {card.business.address}</p>}
                                {card.business.logo_data && <img src={card.business.logo_data} alt="Logo" className="h-10 mt-2 object-contain" />}
                            </div>
                        )}
                        <div className="grid grid-cols-1 gap-3 pt-2 border-t border-slate-100">
                            <div><dt className="text-xs uppercase tracking-wide text-slate-400">Dibuat</dt><dd className="text-slate-700">{formatDate(card.created_at)}</dd></div>
                            <div><dt className="text-xs uppercase tracking-wide text-slate-400">Diaktifkan</dt><dd className="text-slate-700" data-testid="card-detail-activated-at">{formatDate(card.activated_at)}</dd></div>
                            <div><dt className="text-xs uppercase tracking-wide text-slate-400">Terakhir Diubah</dt><dd className="text-slate-700">{formatDate(card.updated_at)}</dd></div>
                        </div>
                    </dl>
                </div>

                {/* History */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h2 className="font-bold text-slate-900 mb-4">Riwayat Perubahan</h2>
                    {!card.history || card.history.length === 0 ? (
                        <p className="text-sm text-slate-400 py-6 text-center" data-testid="card-history-empty">Belum ada riwayat perubahan.</p>
                    ) : (
                        <ol className="relative border-l border-slate-200 ml-2 space-y-6" data-testid="card-history-timeline">
                            {card.history.map((h) => (
                                <li key={h.id} className="ml-5">
                                    <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
                                    <p className="text-xs text-slate-400">{formatDate(h.created_at)}</p>
                                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{h.reason}</p>
                                    <p className="text-xs text-slate-500 mt-1">oleh {h.changed_by}</p>
                                    <div className="mt-2 space-y-1">
                                        {h.old_url && <p className="text-xs font-mono-code text-red-500 line-through break-all">{h.old_url}</p>}
                                        <p className="text-xs font-mono-code text-emerald-600 break-all">{h.new_url}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </div>
        </div>
    );
}
