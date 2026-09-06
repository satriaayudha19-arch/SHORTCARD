import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ShieldCheck, Loader2, CheckCircle2, MessageCircle } from "lucide-react";
import PublicNav from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import api, { formatApiError } from "@/lib/api";
import { usePublicConfig, waLink } from "@/hooks/usePublicConfig";

const INITIAL = {
    card_code: "",
    business_name: "",
    old_url: "",
    new_url: "",
    reason: "",
    requester_name: "",
    requester_phone: "",
    requester_email: "",
};

export default function CorrectionPage() {
    const config = usePublicConfig();
    const [form, setForm] = useState(INITIAL);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post("/public/corrections", {
                card_code: form.card_code.trim(),
                business_name: form.business_name.trim(),
                old_url: form.old_url.trim() || undefined,
                new_url: form.new_url.trim(),
                reason: form.reason.trim(),
                requester_name: form.requester_name.trim(),
                requester_phone: form.requester_phone.trim(),
                requester_email: form.requester_email.trim() || undefined,
            });
            setDone(true);
            toast.success("Permintaan koreksi berhasil dikirim!");
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0B0F17] text-slate-100" data-testid="correction-page">
            <PublicNav />
            <main className="pt-28 pb-20 px-4 sm:px-6">
                <div className="max-w-xl mx-auto">
                    <div className="text-center mb-10">
                        <span className="inline-flex w-14 h-14 rounded-2xl bg-amber-500 items-center justify-center mb-5">
                            <ShieldCheck className="w-7 h-7 text-slate-950" />
                        </span>
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Ajukan Koreksi Link</h1>
                        <p className="text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
                            Bagian dari <strong className="text-amber-400">Lifetime Garansi Link</strong>. Kartu fisik tidak perlu diganti —
                            cukup kirim link terbaru Anda dan kami perbarui dalam hitungan menit.
                        </p>
                    </div>

                    {done ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="rounded-2xl border border-emerald-500/40 bg-[#131B2A] p-8 text-center"
                            data-testid="correction-success"
                        >
                            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold mb-3">Permintaan Terkirim!</h2>
                            <p className="text-slate-400 text-sm leading-relaxed mb-6">
                                Tim Short Card akan meninjau permintaan Anda. Link kartu <span className="font-mono-code text-blue-300">{form.card_code.toUpperCase()}</span> akan
                                diperbarui setelah disetujui. QR Code &amp; NFC tetap sama.
                            </p>
                            <a href={waLink(config, `Halo CS Short Card, saya baru mengajukan koreksi link untuk kartu ${form.card_code.toUpperCase()}.`)} target="_blank" rel="noopener noreferrer">
                                <Button data-testid="correction-cs-button" className="rounded-full bg-emerald-600 hover:bg-emerald-500 font-bold">
                                    <MessageCircle className="w-4 h-4 mr-2" /> Konfirmasi via WhatsApp
                                </Button>
                            </a>
                        </motion.div>
                    ) : (
                        <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-[#131B2A] p-6 sm:p-8 space-y-5" data-testid="correction-form">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="c-code" className="text-slate-300">Kode Kartu *</Label>
                                    <Input id="c-code" data-testid="correction-card-code-input" required value={form.card_code} onChange={set("card_code")} placeholder="SC-0001" className="mt-2 h-12 bg-[#0B0F17] border-slate-700 font-mono-code uppercase" />
                                </div>
                                <div>
                                    <Label htmlFor="c-biz" className="text-slate-300">Nama Bisnis *</Label>
                                    <Input id="c-biz" data-testid="correction-business-name-input" required value={form.business_name} onChange={set("business_name")} className="mt-2 h-12 bg-[#0B0F17] border-slate-700" />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="c-old" className="text-slate-300">Link Lama</Label>
                                <Input id="c-old" data-testid="correction-old-url-input" value={form.old_url} onChange={set("old_url")} placeholder="https://... (opsional, kami deteksi otomatis)" className="mt-2 h-12 bg-[#0B0F17] border-slate-700" />
                            </div>
                            <div>
                                <Label htmlFor="c-new" className="text-slate-300">Link Baru *</Label>
                                <Input id="c-new" data-testid="correction-new-url-input" required value={form.new_url} onChange={set("new_url")} placeholder="https://..." className="mt-2 h-12 bg-[#0B0F17] border-slate-700" />
                            </div>
                            <div>
                                <Label htmlFor="c-reason" className="text-slate-300">Alasan Perubahan *</Label>
                                <Textarea id="c-reason" data-testid="correction-reason-input" required value={form.reason} onChange={set("reason")} rows={3} placeholder="Contoh: Bisnis pindah lokasi, link Google Review berubah." className="mt-2 bg-[#0B0F17] border-slate-700" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="c-name" className="text-slate-300">Nama Pemohon *</Label>
                                    <Input id="c-name" data-testid="correction-requester-name-input" required value={form.requester_name} onChange={set("requester_name")} className="mt-2 h-12 bg-[#0B0F17] border-slate-700" />
                                </div>
                                <div>
                                    <Label htmlFor="c-phone" className="text-slate-300">Nomor WhatsApp *</Label>
                                    <Input id="c-phone" data-testid="correction-requester-phone-input" required value={form.requester_phone} onChange={set("requester_phone")} placeholder="628xxxxxxxxxx" className="mt-2 h-12 bg-[#0B0F17] border-slate-700" />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="c-email" className="text-slate-300">Email</Label>
                                <Input id="c-email" data-testid="correction-requester-email-input" type="email" value={form.requester_email} onChange={set("requester_email")} className="mt-2 h-12 bg-[#0B0F17] border-slate-700" />
                            </div>
                            <Button
                                type="submit"
                                data-testid="correction-submit-button"
                                disabled={loading}
                                className="w-full h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kirim Permintaan Koreksi"}
                            </Button>
                        </form>
                    )}
                </div>
            </main>
            <PublicFooter />
        </div>
    );
}
