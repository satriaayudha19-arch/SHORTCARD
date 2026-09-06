import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
    const { user } = useAuth();
    const [settings, setSettings] = useState(null);
    const [wa, setWa] = useState("");
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        api.get("/admin/settings").then((res) => {
            setSettings(res.data);
            setWa(res.data.cs_whatsapp);
            setLoaded(true);
        }).catch((e) => toast.error(formatApiError(e)));
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            const res = await api.patch("/admin/settings", { cs_whatsapp: wa });
            toast.success(res.data.message);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div data-testid="admin-settings-page" className="max-w-2xl">
            <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Pengaturan</h1>
                <p className="text-sm text-slate-500 mt-1">Konfigurasi dasar platform Short Card.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                {!settings ? (
                    <Skeleton className="h-24 w-full" />
                ) : (
                    <>
                        <div>
                            <Label htmlFor="cs-wa" className="font-semibold text-slate-900">Nomor WhatsApp Customer Service</Label>
                            <p className="text-xs text-slate-500 mt-1 mb-3">Digunakan pada tombol "Hubungi Customer Service" di seluruh halaman publik. Format: 628xxxxxxxxxx</p>
                            <Input id="cs-wa" data-testid="settings-cs-whatsapp-input" value={wa} onChange={(e) => setWa(e.target.value)} disabled={!loaded} className="max-w-sm" />
                        </div>
                        <div>
                            <Label className="font-semibold text-slate-900">Base URL Publik</Label>
                            <p className="text-xs text-slate-500 mt-1 mb-3">Prefix URL publik kartu (/r/SC-XXXX). Diatur melalui environment variable PUBLIC_BASE_URL di server.</p>
                            <Input data-testid="settings-base-url" value={settings.public_base_url} disabled className="max-w-sm bg-slate-50 font-mono-code text-xs" />
                        </div>
                        <div>
                            <Label className="font-semibold text-slate-900">Akun Admin</Label>
                            <p className="text-xs text-slate-500 mt-1">Masuk sebagai <span className="font-mono-code">{user?.email}</span>. Kredensial admin dikelola melalui environment variable server.</p>
                        </div>
                        <Button data-testid="settings-save-button" onClick={save} disabled={!loaded || saving || wa.trim().length < 6} className="rounded-full bg-blue-600 hover:bg-blue-700">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Simpan Pengaturan</>}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
