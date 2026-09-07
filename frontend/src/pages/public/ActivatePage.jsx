import { useState } from "react";
import { Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
    Nfc, Star, Instagram, Music2, Youtube, Facebook, MessageCircle, Link2,
    ArrowRight, ArrowLeft, CheckCircle2, Copy, Loader2, Upload,
} from "lucide-react";
import PublicNav from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import api, { API_BASE, formatApiError } from "@/lib/api";

const DEST_TYPES = [
    { value: "GOOGLE_REVIEW", label: "Google Review", icon: Star, hint: "https://search.google.com/local/writereview?placeid=..." },
    { value: "INSTAGRAM", label: "Instagram", icon: Instagram, hint: "https://instagram.com/username" },
    { value: "TIKTOK", label: "TikTok", icon: Music2, hint: "https://tiktok.com/@username" },
    { value: "YOUTUBE", label: "YouTube", icon: Youtube, hint: "https://youtube.com/@channel" },
    { value: "FACEBOOK", label: "Facebook", icon: Facebook, hint: "https://facebook.com/page" },
    { value: "WHATSAPP", label: "WhatsApp", icon: MessageCircle, hint: "https://wa.me/628xxxxxxxxxx" },
    { value: "CUSTOM", label: "Custom URL", icon: Link2, hint: "https://website-anda.com" },
];

const STEP_LABELS = ["Kode Kartu", "Jenis Tujuan", "Link & Bisnis", "Konfirmasi"];

export default function ActivatePage() {
    const { user } = useAuth();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [code, setCode] = useState("");
    const [cardInfo, setCardInfo] = useState(null);
    const [destType, setDestType] = useState("");
    const [destUrl, setDestUrl] = useState("");
    const [biz, setBiz] = useState({ name: "", owner_name: "", whatsapp: "", email: "", address: "" });
    const [logo, setLogo] = useState(null);
    const [result, setResult] = useState(null);

    if (user === null) {
        return (
            <div className="min-h-screen bg-[#0B0F17] pt-32 px-6" data-testid="activate-auth-loading">
                <div className="max-w-xl mx-auto space-y-4">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }
    if (user === false) {
        return <Navigate to="/admin/login" state={{ from: "/activate" }} replace />;
    }

    const validateCard = async () => {
        if (!code.trim()) return;
        setLoading(true);
        try {
            const res = await api.get(`/public/cards/${encodeURIComponent(code.trim())}`);
            if (res.data.status === "ACTIVE") {
                toast.error("Kartu ini sudah aktif. Gunakan halaman Ajukan Koreksi Link untuk mengubah tujuan.");
                return;
            }
            if (res.data.status === "DISABLED") {
                toast.error("Kartu ini dinonaktifkan. Silakan hubungi Customer Service.");
                return;
            }
            setCardInfo(res.data);
            setStep(1);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    };

    const handleLogo = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 350 * 1024) {
            toast.error("Ukuran logo maksimal 350KB.");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setLogo(reader.result);
        reader.readAsDataURL(file);
    };

    const submitActivation = async () => {
        setLoading(true);
        try {
            const payload = {
                destination_type: destType,
                destination_url: destUrl.trim(),
                business: {
                    name: biz.name.trim(),
                    owner_name: biz.owner_name.trim() || undefined,
                    whatsapp: biz.whatsapp.trim() || undefined,
                    email: biz.email.trim() || undefined,
                    address: biz.address.trim() || undefined,
                    logo_data: logo || undefined,
                },
            };
            const res = await api.post(`/admin/cards/${encodeURIComponent(cardInfo.code)}/activate`, payload);
            setResult(res.data);
            setStep(4);
            toast.success("Kartu berhasil diaktifkan!");
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    };

    const copyUrl = () => {
        navigator.clipboard.writeText(result.public_url);
        toast.success("URL permanen disalin! Tulis URL ini ke NFC NTAG213.");
    };

    const resetFlow = () => {
        setStep(0);
        setCode("");
        setCardInfo(null);
        setDestType("");
        setDestUrl("");
        setBiz({ name: "", owner_name: "", whatsapp: "", email: "", address: "" });
        setLogo(null);
        setResult(null);
    };

    const canNextStep2 = destType !== "";
    const canNextStep3 = destUrl.trim().length > 8 && biz.name.trim().length >= 2;

    return (
        <div className="min-h-screen bg-[#0B0F17] text-slate-100" data-testid="activate-page">
            <PublicNav />
            <main className="pt-28 pb-20 px-4 sm:px-6">
                <div className="max-w-xl mx-auto">
                    <div className="text-center mb-10">
                        <span className="inline-flex w-14 h-14 rounded-2xl bg-blue-600 items-center justify-center mb-5">
                            <Nfc className="w-7 h-7 text-white" />
                        </span>
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Aktivasi Kartu</h1>
                        <p className="text-slate-400 mt-3 text-sm sm:text-base">Alat operator Short Card: konfigurasikan link tujuan kartu, lalu tulis URL permanen ke NFC NTAG213.</p>
                    </div>

                    {step < 4 && (
                        <div className="flex items-center gap-2 mb-8" data-testid="activation-steps">
                            {STEP_LABELS.map((label, i) => (
                                <div key={label} className="flex-1">
                                    <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-blue-500" : "bg-slate-800"}`} />
                                    <p className={`text-[10px] sm:text-xs mt-2 ${i <= step ? "text-blue-300" : "text-slate-600"}`}>{label}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {step === 0 && (
                            <motion.div key="s0" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="rounded-2xl border border-slate-800 bg-[#131B2A] p-6 sm:p-8">
                                <Label htmlFor="card-code" className="text-slate-300">Kode Kartu</Label>
                                <Input
                                    id="card-code"
                                    data-testid="activation-code-input"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    placeholder="Contoh: SC-0004"
                                    className="mt-2 h-14 text-lg font-mono-code bg-[#0B0F17] border-slate-700 text-center tracking-widest"
                                    onKeyDown={(e) => e.key === "Enter" && validateCard()}
                                />
                                <p className="text-xs text-slate-500 mt-3">Kode tercetak pada kartu fisik Anda, misalnya SC-0004.</p>
                                <Button
                                    data-testid="activation-validate-button"
                                    onClick={validateCard}
                                    disabled={loading || !code.trim()}
                                    className="w-full mt-6 h-12 rounded-full bg-blue-600 hover:bg-blue-500 font-bold"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Validasi Kartu <ArrowRight className="w-4 h-4 ml-2" /></>}
                                </Button>
                            </motion.div>
                        )}

                        {step === 1 && (
                            <motion.div key="s1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="rounded-2xl border border-slate-800 bg-[#131B2A] p-6 sm:p-8">
                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="font-bold text-lg">Pilih Jenis Tujuan</h2>
                                    <span className="font-mono-code text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" data-testid="activation-card-code-badge">
                                        {cardInfo?.code}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {DEST_TYPES.map((d) => (
                                        <button
                                            key={d.value}
                                            data-testid={`dest-type-${d.value.toLowerCase()}`}
                                            onClick={() => setDestType(d.value)}
                                            className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-colors ${
                                                destType === d.value
                                                    ? "border-blue-500 bg-blue-600/15 text-white"
                                                    : "border-slate-700 bg-[#0B0F17] text-slate-300 hover:border-slate-500"
                                            }`}
                                        >
                                            <d.icon className="w-5 h-5 shrink-0" />
                                            <span className="text-sm font-semibold">{d.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <Button variant="outline" data-testid="activation-back-button" onClick={() => setStep(0)} className="rounded-full border-slate-700 text-slate-300">
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
                                    </Button>
                                    <Button data-testid="activation-next-button" onClick={() => setStep(2)} disabled={!canNextStep2} className="flex-1 rounded-full bg-blue-600 hover:bg-blue-500 font-bold">
                                        Lanjut <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div key="s2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="rounded-2xl border border-slate-800 bg-[#131B2A] p-6 sm:p-8 space-y-5">
                                <h2 className="font-bold text-lg">Link Tujuan & Data Bisnis</h2>
                                <div>
                                    <Label htmlFor="dest-url" className="text-slate-300">URL Tujuan ({DEST_TYPES.find((d) => d.value === destType)?.label})</Label>
                                    <Input
                                        id="dest-url"
                                        data-testid="activation-destination-url-input"
                                        value={destUrl}
                                        onChange={(e) => setDestUrl(e.target.value)}
                                        placeholder={DEST_TYPES.find((d) => d.value === destType)?.hint}
                                        className="mt-2 h-12 bg-[#0B0F17] border-slate-700"
                                    />
                                    {destType === "GOOGLE_REVIEW" && (
                                        <p className="text-xs text-amber-400/90 mt-2">
                                            Gunakan link review langsung (bukan sekadar link pencarian Maps) agar pelanggan langsung bisa menulis ulasan.
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="biz-name" className="text-slate-300">Nama Bisnis *</Label>
                                    <Input id="biz-name" data-testid="activation-business-name-input" value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} placeholder="Contoh: Kopi Senja" className="mt-2 h-12 bg-[#0B0F17] border-slate-700" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="biz-owner" className="text-slate-300">Nama Pemilik</Label>
                                        <Input id="biz-owner" data-testid="activation-owner-input" value={biz.owner_name} onChange={(e) => setBiz({ ...biz, owner_name: e.target.value })} className="mt-2 h-12 bg-[#0B0F17] border-slate-700" />
                                    </div>
                                    <div>
                                        <Label htmlFor="biz-wa" className="text-slate-300">WhatsApp</Label>
                                        <Input id="biz-wa" data-testid="activation-whatsapp-input" value={biz.whatsapp} onChange={(e) => setBiz({ ...biz, whatsapp: e.target.value })} placeholder="628xxxxxxxxxx" className="mt-2 h-12 bg-[#0B0F17] border-slate-700" />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="biz-email" className="text-slate-300">Email</Label>
                                    <Input id="biz-email" data-testid="activation-email-input" type="email" value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} className="mt-2 h-12 bg-[#0B0F17] border-slate-700" />
                                </div>
                                <div>
                                    <Label htmlFor="biz-address" className="text-slate-300">Alamat</Label>
                                    <Textarea id="biz-address" data-testid="activation-address-input" value={biz.address} onChange={(e) => setBiz({ ...biz, address: e.target.value })} rows={2} className="mt-2 bg-[#0B0F17] border-slate-700" />
                                </div>
                                <div>
                                    <Label className="text-slate-300">Logo Bisnis (opsional, maks 350KB)</Label>
                                    <label
                                        data-testid="activation-logo-upload"
                                        className="mt-2 flex items-center justify-center gap-3 h-24 rounded-xl border border-dashed border-slate-700 bg-[#0B0F17] cursor-pointer hover:border-slate-500 transition-colors"
                                    >
                                        {logo ? (
                                            <img src={logo} alt="Logo bisnis" className="h-16 object-contain" />
                                        ) : (
                                            <>
                                                <Upload className="w-5 h-5 text-slate-500" />
                                                <span className="text-sm text-slate-500">Klik untuk upload logo</span>
                                            </>
                                        )}
                                        <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                                    </label>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button variant="outline" onClick={() => setStep(1)} className="rounded-full border-slate-700 text-slate-300">
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
                                    </Button>
                                    <Button data-testid="activation-review-button" onClick={() => setStep(3)} disabled={!canNextStep3} className="flex-1 rounded-full bg-blue-600 hover:bg-blue-500 font-bold">
                                        Tinjau <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div key="s3" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="rounded-2xl border border-slate-800 bg-[#131B2A] p-6 sm:p-8">
                                <h2 className="font-bold text-lg mb-5">Konfirmasi Aktivasi</h2>
                                <dl className="space-y-4 text-sm">
                                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Kode Kartu</dt><dd className="font-mono-code font-semibold" data-testid="confirm-card-code">{cardInfo?.code}</dd></div>
                                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Jenis Tujuan</dt><dd className="font-semibold" data-testid="confirm-dest-type">{DEST_TYPES.find((d) => d.value === destType)?.label}</dd></div>
                                    <div><dt className="text-slate-500 mb-1">URL Tujuan</dt><dd className="font-mono-code text-xs break-all text-blue-300 bg-[#0B0F17] rounded-lg p-3 border border-slate-800" data-testid="confirm-dest-url">{destUrl}</dd></div>
                                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Bisnis</dt><dd className="font-semibold text-right">{biz.name}</dd></div>
                                </dl>
                                <p className="text-xs text-slate-500 mt-5 leading-relaxed">
                                    Setelah aktif, QR Code (sudah tercetak) &amp; NFC kartu akan mengarah ke URL Short Card permanen. Link tujuan dapat diubah kapan saja tanpa mengganti kartu.
                                </p>
                                <div className="flex gap-3 mt-6">
                                    <Button variant="outline" onClick={() => setStep(2)} className="rounded-full border-slate-700 text-slate-300">
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Ubah
                                    </Button>
                                    <Button
                                        data-testid="activation-submit-button"
                                        onClick={submitActivation}
                                        disabled={loading}
                                        className="flex-1 rounded-full bg-emerald-600 hover:bg-emerald-500 font-bold h-12"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aktifkan Kartu Sekarang"}
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 4 && result && (
                            <motion.div key="s4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4" data-testid="activation-success">
                                <div className="rounded-2xl border border-emerald-500/40 bg-[#131B2A] p-6 sm:p-8">
                                    <div className="text-center mb-6">
                                        <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-3" />
                                        <h2 className="text-2xl font-bold">Kartu Berhasil Diaktifkan!</h2>
                                    </div>
                                    <dl className="space-y-3 text-sm">
                                        <div className="flex justify-between gap-4"><dt className="text-slate-500">Kode Kartu</dt><dd className="font-mono-code font-bold" data-testid="result-card-code">{result.code}</dd></div>
                                        <div className="flex justify-between gap-4"><dt className="text-slate-500">Bisnis</dt><dd className="font-semibold text-right" data-testid="result-business-name">{result.business_name}</dd></div>
                                        <div className="flex justify-between gap-4"><dt className="text-slate-500">Jenis Tujuan</dt><dd className="font-semibold" data-testid="result-dest-type">{DEST_TYPES.find((d) => d.value === result.destination_type)?.label}</dd></div>
                                        <div>
                                            <dt className="text-slate-500 mb-1">URL Tujuan Saat Ini</dt>
                                            <dd className="font-mono-code text-xs break-all text-blue-300 bg-[#0B0F17] rounded-lg p-3 border border-slate-800" data-testid="result-dest-url">{result.destination_url}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-slate-500 mb-1">URL Short Card Permanen</dt>
                                            <dd className="font-mono-code text-xs break-all text-emerald-300 bg-[#0B0F17] rounded-lg p-3 border border-emerald-500/30" data-testid="result-public-url">{result.public_url}</dd>
                                        </div>
                                        <div className="flex justify-between gap-4"><dt className="text-slate-500">QR Code</dt><dd className="text-emerald-400 font-semibold text-right" data-testid="result-qr-status">QR sudah tercetak pada kartu</dd></div>
                                        <div className="flex justify-between gap-4"><dt className="text-slate-500">NFC</dt><dd className="text-amber-400 font-semibold text-right" data-testid="result-nfc-status">NFC siap diprogram</dd></div>
                                    </dl>
                                </div>

                                <div className="rounded-2xl border border-blue-500/40 bg-blue-600/10 p-6 sm:p-8" data-testid="nfc-programming-section">
                                    <h3 className="font-bold text-lg flex items-center gap-2 mb-1"><Nfc className="w-5 h-5 text-blue-400" /> NFC NTAG213</h3>
                                    <p className="text-xs text-slate-400 mb-4">Status: <span className="text-amber-400 font-semibold">Siap diprogram</span></p>
                                    <div className="bg-[#0B0F17] border border-slate-700 rounded-xl px-4 py-3 mb-4">
                                        <span className="font-mono-code text-xs sm:text-sm text-blue-300 break-all" data-testid="nfc-url-text">{result.public_url}</span>
                                    </div>
                                    <Button data-testid="copy-nfc-url-button" onClick={copyUrl} className="w-full h-12 rounded-full bg-blue-600 hover:bg-blue-500 font-bold text-base">
                                        <Copy className="w-4 h-4 mr-2" /> Salin URL NFC
                                    </Button>
                                    <p className="text-sm text-slate-300 mt-4 leading-relaxed">
                                        Gunakan URL ini untuk ditulis ke NFC NTAG213 melalui aplikasi NFC writer di Android. Setelah selesai, lakukan test tap menggunakan smartphone.
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                                        QR Code pada kartu tidak perlu dicetak ulang — QR &amp; NFC mengarah ke URL permanen yang sama.
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-[#131B2A] p-5 text-center">
                                    <p className="text-xs text-slate-500 mb-3">Verifikasi QR (opsional) — QR fisik sudah tercetak pada kartu</p>
                                    <img src={`${API_BASE}/public/cards/${result.code}/qr.png`} alt={`QR verifikasi ${result.code}`} className="w-24 h-24 mx-auto rounded-lg bg-white p-1" data-testid="activation-qr-preview" />
                                    <Button variant="outline" data-testid="activation-new-card-button" onClick={resetFlow} className="w-full mt-5 rounded-full border-slate-700 text-slate-200">
                                        Aktivasi Kartu Lain
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
            <PublicFooter />
        </div>
    );
}
