import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Loader2, Pencil, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const EMPTY = {
    name: "", owner_name: "", whatsapp: "", email: "", address: "",
    google_maps_url: "", google_review_url: "",
    instagram_url: "", tiktok_url: "", facebook_url: "", youtube_url: "", whatsapp_url: "",
};

export default function BusinessesPage() {
    const [data, setData] = useState(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [verifyState, setVerifyState] = useState("idle"); // idle | loading | success | error
    const [verifyInfo, setVerifyInfo] = useState(null);
    const [verifyError, setVerifyError] = useState("");

    const resetVerify = () => {
        setVerifyState("idle");
        setVerifyInfo(null);
        setVerifyError("");
    };

    const load = useCallback(() => {
        const params = new URLSearchParams({ page: String(page), limit: "10" });
        if (search) params.set("search", search);
        api.get(`/admin/businesses?${params}`).then((res) => setData(res.data)).catch((e) => toast.error(formatApiError(e)));
    }, [page, search]);

    useEffect(() => {
        const t = setTimeout(load, 250);
        return () => clearTimeout(t);
    }, [load]);

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY);
        resetVerify();
        setDialogOpen(true);
    };

    const openEdit = (b) => {
        setEditing(b);
        setForm({
            name: b.name || "",
            owner_name: b.owner_name || "",
            whatsapp: b.whatsapp || "",
            email: b.email || "",
            address: b.address || "",
            google_maps_url: b.google_maps_url || "",
            google_review_url: b.google_review_url || "",
            instagram_url: b.instagram_url || "",
            tiktok_url: b.tiktok_url || "",
            facebook_url: b.facebook_url || "",
            youtube_url: b.youtube_url || "",
            whatsapp_url: b.whatsapp_url || "",
        });
        resetVerify();
        setDialogOpen(true);
    };

    const save = async () => {
        setSaving(true);
        const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== ""));
        try {
            if (editing) {
                await api.patch(`/admin/businesses/${editing.id}`, payload);
                toast.success("Bisnis diperbarui.");
            } else {
                await api.post("/admin/businesses", payload);
                toast.success("Bisnis ditambahkan.");
            }
            setDialogOpen(false);
            load();
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setSaving(false);
        }
    };

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    const verifyGoogle = async () => {
        setVerifyState("loading");
        setVerifyError("");
        setVerifyInfo(null);
        try {
            const payload = { google_maps_url: form.google_maps_url.trim() };
            if (editing) payload.business_id = editing.id;
            else payload.business_name = form.name.trim();
            const res = await api.post("/admin/businesses/verify-google", payload);
            setVerifyInfo(res.data);
            setVerifyState("success");
            setForm((f) => ({
                ...f,
                google_review_url: res.data.google_review_url,
                name: f.name.trim() || res.data.business_name || f.name,
            }));
            if (!editing && res.data.business_id) {
                const detail = await api.get(`/admin/businesses/${res.data.business_id}`);
                setEditing(detail.data);
                toast.success("Bisnis dibuat dengan data Google terverifikasi.");
            } else {
                toast.success("Google Business terverifikasi.");
            }
            load();
        } catch (e) {
            setVerifyError(formatApiError(e));
            setVerifyState("error");
        }
    };

    return (
        <div data-testid="admin-businesses-page">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Bisnis</h1>
                    <p className="text-sm text-slate-500 mt-1">Data pelanggan dan bisnis pemilik kartu.</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button data-testid="business-create-button" onClick={openCreate} className="rounded-full bg-blue-600 hover:bg-blue-700 font-semibold">
                            <Plus className="w-4 h-4 mr-2" /> Tambah Bisnis
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white max-h-[90vh] overflow-y-auto" aria-describedby="business-form-desc">
                        <DialogHeader><DialogTitle>{editing ? "Ubah Bisnis" : "Tambah Bisnis"}</DialogTitle></DialogHeader>
                        <p id="business-form-desc" className="text-xs text-slate-500">Kelola data bisnis, verifikasi Google Business, dan URL social media. URL tervalidasi otomatis tersimpan ke bisnis dan terpropagasi ke kartu aktif terkait.</p>
                        <div className="space-y-4 pt-2">
                            <div><Label>Nama Bisnis *</Label><Input data-testid="business-form-name" value={form.name} onChange={set("name")} className="mt-2" /></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><Label>Pemilik</Label><Input data-testid="business-form-owner" value={form.owner_name} onChange={set("owner_name")} className="mt-2" /></div>
                                <div><Label>WhatsApp</Label><Input data-testid="business-form-whatsapp" value={form.whatsapp} onChange={set("whatsapp")} className="mt-2" /></div>
                            </div>
                            <div><Label>Email</Label><Input data-testid="business-form-email" type="email" value={form.email} onChange={set("email")} className="mt-2" /></div>
                            <div><Label>Alamat</Label><Input data-testid="business-form-address" value={form.address} onChange={set("address")} className="mt-2" /></div>

                            {/* ENGINE A — Google Business Verification */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3" data-testid="google-verification-section">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Google Business</p>
                                    {editing?.google_verified && verifyState !== "success" && (
                                        <Badge data-testid="google-verified-badge" className="bg-emerald-100 text-emerald-700 border-emerald-200">Terverifikasi</Badge>
                                    )}
                                </div>
                                <div>
                                    <Label>Google Maps URL</Label>
                                    <Input data-testid="business-form-google-maps" value={form.google_maps_url} onChange={set("google_maps_url")} placeholder="https://maps.app.goo.gl/..." className="mt-2" />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    data-testid="business-verify-google-button"
                                    onClick={verifyGoogle}
                                    disabled={verifyState === "loading" || !form.google_maps_url.trim() || (!editing && form.name.trim().length < 2)}
                                    className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                                >
                                    {verifyState === "loading" ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memverifikasi Google Business...</>
                                    ) : (
                                        <><ShieldCheck className="w-4 h-4 mr-2" /> Verifikasi Google Business</>
                                    )}
                                </Button>
                                {!editing && form.name.trim().length < 2 && (
                                    <p className="text-xs text-slate-400">Isi Nama Bisnis terlebih dahulu untuk verifikasi.</p>
                                )}
                                {verifyState === "success" && verifyInfo && (
                                    <div data-testid="google-verify-success" className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs space-y-1.5">
                                        <p className="font-bold text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Google Business verified</p>
                                        <p className="text-slate-700"><span className="text-slate-500">Nama:</span> {verifyInfo.business_name}</p>
                                        {verifyInfo.address && <p className="text-slate-700"><span className="text-slate-500">Alamat:</span> {verifyInfo.address}</p>}
                                        <p className="font-mono-code text-slate-700 break-all"><span className="text-slate-500 font-sans">Place ID:</span> {verifyInfo.place_id}</p>
                                        <p className="font-mono-code text-blue-700 break-all">{verifyInfo.google_review_url}</p>
                                    </div>
                                )}
                                {verifyState === "error" && (
                                    <div data-testid="google-verify-error" className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                                        Google Business could not be verified. {verifyError}
                                    </div>
                                )}
                                <div>
                                    <Label>Google Review URL (dibuat otomatis setelah verifikasi)</Label>
                                    <Input data-testid="business-form-google-review" value={form.google_review_url} readOnly disabled placeholder="Akan terisi otomatis" className="mt-2 bg-slate-100 font-mono-code text-xs" />
                                </div>
                            </div>

                            {/* ENGINE B — Social Media Destination Validator (validasi otomatis saat simpan) */}
                            <div className="rounded-xl border border-slate-200 p-4 space-y-3" data-testid="social-media-section">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Social Media</p>
                                <div><Label>Instagram</Label><Input data-testid="business-form-instagram" value={form.instagram_url} onChange={set("instagram_url")} placeholder="https://instagram.com/username" className="mt-2" /></div>
                                <div><Label>TikTok</Label><Input data-testid="business-form-tiktok" value={form.tiktok_url} onChange={set("tiktok_url")} placeholder="https://tiktok.com/@username" className="mt-2" /></div>
                                <div><Label>Facebook</Label><Input data-testid="business-form-facebook" value={form.facebook_url} onChange={set("facebook_url")} placeholder="https://facebook.com/namapage" className="mt-2" /></div>
                                <div><Label>YouTube</Label><Input data-testid="business-form-youtube" value={form.youtube_url} onChange={set("youtube_url")} placeholder="https://youtube.com/@channel" className="mt-2" /></div>
                                <div><Label>WhatsApp Link</Label><Input data-testid="business-form-whatsapp-url" value={form.whatsapp_url} onChange={set("whatsapp_url")} placeholder="https://wa.me/628xxxxxxxxxx" className="mt-2" /></div>
                                <p className="text-xs text-slate-400">URL social media divalidasi &amp; dinormalisasi otomatis saat disimpan — tanpa API eksternal.</p>
                            </div>
                            <Button data-testid="business-form-submit" onClick={save} disabled={saving || form.name.trim().length < 2} className="w-full bg-blue-600 hover:bg-blue-700">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="relative mb-5 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input data-testid="business-search-input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Cari nama bisnis..." className="pl-10 bg-white" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                                <th className="px-5 py-4 font-semibold">Bisnis</th>
                                <th className="px-5 py-4 font-semibold hidden md:table-cell">Kontak</th>
                                <th className="px-5 py-4 font-semibold">Kartu</th>
                                <th className="px-5 py-4 font-semibold text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!data ? (
                                [...Array(3)].map((_, i) => (
                                    <tr key={i} className="border-b border-slate-50"><td colSpan={4} className="px-5 py-4"><Skeleton className="h-5 w-full" /></td></tr>
                                ))
                            ) : data.items.length === 0 ? (
                                <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400" data-testid="businesses-empty-state">Belum ada bisnis.</td></tr>
                            ) : (
                                data.items.map((b) => (
                                    <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/60" data-testid={`business-row-${b.id}`}>
                                        <td className="px-5 py-4">
                                            <p className="font-semibold text-slate-900">{b.name}</p>
                                            {b.owner_name && <p className="text-xs text-slate-500">{b.owner_name}</p>}
                                        </td>
                                        <td className="px-5 py-4 hidden md:table-cell text-slate-600 text-xs">
                                            {b.whatsapp && <p>WA: {b.whatsapp}</p>}
                                            {b.email && <p>{b.email}</p>}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {b.cards && b.cards.length > 0
                                                    ? b.cards.map((c) => <Badge key={c} variant="outline" className="font-mono-code text-xs">{c}</Badge>)
                                                    : <span className="text-slate-400 text-xs">-</span>}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <Button size="sm" variant="outline" data-testid={`business-edit-${b.id}`} onClick={() => openEdit(b)} className="rounded-full">
                                                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Ubah
                                            </Button>
                                        </td>
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
