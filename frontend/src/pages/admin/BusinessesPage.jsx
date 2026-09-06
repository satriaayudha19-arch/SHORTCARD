import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const EMPTY = { name: "", owner_name: "", whatsapp: "", email: "", address: "", google_review_url: "", instagram_url: "" };

export default function BusinessesPage() {
    const [data, setData] = useState(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);

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
            google_review_url: b.google_review_url || "",
            instagram_url: b.instagram_url || "",
        });
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
                    <DialogContent className="bg-white max-h-[90vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>{editing ? "Ubah Bisnis" : "Tambah Bisnis"}</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div><Label>Nama Bisnis *</Label><Input data-testid="business-form-name" value={form.name} onChange={set("name")} className="mt-2" /></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><Label>Pemilik</Label><Input data-testid="business-form-owner" value={form.owner_name} onChange={set("owner_name")} className="mt-2" /></div>
                                <div><Label>WhatsApp</Label><Input data-testid="business-form-whatsapp" value={form.whatsapp} onChange={set("whatsapp")} className="mt-2" /></div>
                            </div>
                            <div><Label>Email</Label><Input data-testid="business-form-email" type="email" value={form.email} onChange={set("email")} className="mt-2" /></div>
                            <div><Label>Alamat</Label><Input data-testid="business-form-address" value={form.address} onChange={set("address")} className="mt-2" /></div>
                            <div><Label>Google Review URL</Label><Input data-testid="business-form-google-review" value={form.google_review_url} onChange={set("google_review_url")} placeholder="https://..." className="mt-2" /></div>
                            <div><Label>Instagram URL</Label><Input data-testid="business-form-instagram" value={form.instagram_url} onChange={set("instagram_url")} placeholder="https://..." className="mt-2" /></div>
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
