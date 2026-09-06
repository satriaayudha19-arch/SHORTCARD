import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Nfc, QrCode, Smartphone, Palette, ShieldCheck, RefreshCw, Star,
    Instagram, Music2, Youtube, Facebook, MessageCircle, Link2, ArrowRight,
    BadgeCheck, Infinity as InfinityIcon,
} from "lucide-react";
import PublicNav from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";
import { usePublicConfig, waLink } from "@/hooks/usePublicConfig";

const IMG_BLACK = "https://static.prod-images.emergentagent.com/jobs/48d582bf-d544-42f9-8808-8a5687b26bee/images/e8bfe2cdb24e4056508f95526ec3873911d0f753ced8cb898e131e98e3b5fed4.jpeg";
const IMG_WHITE = "https://static.prod-images.emergentagent.com/jobs/48d582bf-d544-42f9-8808-8a5687b26bee/images/333cbbb9f09f0de5cc676e7300a0f9e30c685910df74e069a642d4e6fd4c7b8c.jpeg";
const IMG_TAP = "https://static.prod-images.emergentagent.com/jobs/48d582bf-d544-42f9-8808-8a5687b26bee/images/98b11c9a65aa05154a1de5a5a9ab0a057dce6c96b669b697c8a748d2e124be34.jpeg";

const BENEFITS = [
    { icon: Nfc, title: "NFC + QR Code", desc: "Satu kartu, dua metode akses. Tap NFC atau scan QR — pelanggan langsung terhubung." },
    { icon: Smartphone, title: "Tanpa Aplikasi", desc: "Pelanggan cukup tap atau scan menggunakan smartphone. Tidak perlu instal aplikasi apa pun." },
    { icon: Palette, title: "Custom Logo", desc: "Tampilkan logo bisnis Anda pada kartu dengan desain yang tetap minimalis dan premium." },
    { icon: BadgeCheck, title: "Hitam & Putih", desc: "Tersedia dua varian warna elegan: Black dan White, sesuai karakter brand Anda." },
    { icon: RefreshCw, title: "Easy to Update", desc: "Link tujuan diperbarui dari server. QR dan NFC tidak perlu dicetak ulang." },
    { icon: InfinityIcon, title: "Lifetime Garansi Link", desc: "Link berubah atau bisnis pindah lokasi? Kartu tetap berfungsi selamanya." },
];

const USE_CASES = [
    { icon: Star, name: "Google Review", desc: "Langsung ke halaman tulis review Google bisnis Anda.", color: "text-amber-400" },
    { icon: Instagram, name: "Instagram", desc: "Arahkan pelanggan ke profil Instagram bisnis.", color: "text-pink-400" },
    { icon: Music2, name: "TikTok", desc: "Tumbuhkan akun TikTok bisnis Anda.", color: "text-slate-200" },
    { icon: Youtube, name: "YouTube", desc: "Arahkan ke channel YouTube Anda.", color: "text-red-400" },
    { icon: Facebook, name: "Facebook", desc: "Buka halaman Facebook bisnis Anda.", color: "text-blue-400" },
    { icon: MessageCircle, name: "WhatsApp", desc: "Pelanggan langsung chat WhatsApp bisnis.", color: "text-emerald-400" },
    { icon: Link2, name: "Custom Link", desc: "Website, katalog, atau URL apa pun.", color: "text-sky-400" },
];

const STEPS = [
    { num: "01", title: "Terima Kartu", desc: "Anda menerima kartu Short Card dengan kode unik, misal SC-0001." },
    { num: "02", title: "Aktivasi Link", desc: "Masukkan kode kartu dan pilih link tujuan bisnis Anda di halaman aktivasi." },
    { num: "03", title: "Tap / Scan", desc: "Pelanggan tap NFC atau scan QR Code pada kartu Anda." },
    { num: "04", title: "Langsung Terhubung", desc: "Pelanggan langsung diarahkan ke Google Review atau link bisnis Anda." },
];

const fadeUp = {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.55, ease: "easeOut" },
};

export default function LandingPage() {
    const config = usePublicConfig();

    return (
        <div className="min-h-screen bg-[#0B0F17] text-slate-100" data-testid="landing-page">
            <PublicNav />

            {/* HERO */}
            <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[420px] rounded-full bg-blue-600/15 blur-[120px]" />
                </div>
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-wider mb-6">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Lifetime Garansi Link
                            </div>
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-glow">
                                Satu Kartu. Satu Tap.{" "}
                                <span className="text-blue-400">Semua Terhubung.</span>
                            </h1>
                            <p className="mt-6 text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl">
                                Short Card menghubungkan pelanggan Anda langsung ke Google Review, Instagram, TikTok, YouTube,
                                Facebook, WhatsApp, dan berbagai link bisnis lainnya melalui NFC + QR Code.
                            </p>
                            <div className="mt-8 flex flex-col sm:flex-row gap-4">
                                <Link to="/activate">
                                    <button
                                        data-testid="hero-activate-button"
                                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-base transition-all hover:shadow-[0_0_32px_rgba(59,130,246,0.45)]"
                                    >
                                        Aktifkan Kartu <ArrowRight className="w-4 h-4" />
                                    </button>
                                </Link>
                                <Link to="/correction">
                                    <button
                                        data-testid="hero-correction-button"
                                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-slate-600 hover:border-slate-400 text-slate-200 font-bold text-base transition-colors"
                                    >
                                        Ajukan Koreksi Link
                                    </button>
                                </Link>
                            </div>
                            <div className="mt-8 flex items-center gap-6 text-xs text-slate-500">
                                <span className="flex items-center gap-1.5"><Nfc className="w-4 h-4 text-blue-400" /> NFC Ready</span>
                                <span className="flex items-center gap-1.5"><QrCode className="w-4 h-4 text-blue-400" /> QR Code</span>
                                <span className="flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-blue-400" /> Tanpa Aplikasi</span>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.94 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.7, delay: 0.15 }}
                            className="relative"
                        >
                            <div className="relative rounded-3xl overflow-hidden border border-slate-800 shadow-2xl shadow-blue-950/40">
                                <img
                                    src={IMG_TAP}
                                    alt="Pelanggan tap kartu NFC Short Card di kasir kafe"
                                    className="w-full object-cover max-h-[60vh] lg:max-h-none"
                                    loading="eager"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17]/80 via-transparent to-transparent" />
                                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                                    <div className="glass-panel rounded-2xl px-4 py-3 border border-slate-700/60">
                                        <p className="text-[10px] uppercase tracking-widest text-slate-400">Contoh URL Kartu</p>
                                        <p className="font-mono-code text-xs sm:text-sm text-blue-300 mt-0.5">/r/SC-0001</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* BENEFITS */}
            <section id="fitur" className="py-16 sm:py-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div {...fadeUp} className="max-w-2xl mb-12">
                        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400 mb-3">Keunggulan</p>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                            Dirancang untuk bisnis yang ingin terus terhubung
                        </h2>
                    </motion.div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {BENEFITS.map((b, i) => (
                            <motion.div
                                key={b.title}
                                {...fadeUp}
                                transition={{ ...fadeUp.transition, delay: i * 0.06 }}
                                data-testid={`benefit-card-${i}`}
                                className="group rounded-2xl border border-slate-800 bg-[#131B2A] p-6 hover:border-blue-500/50 transition-colors"
                            >
                                <span className="w-11 h-11 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center mb-5 group-hover:bg-blue-600/25 transition-colors">
                                    <b.icon className="w-5 h-5 text-blue-400" />
                                </span>
                                <h3 className="text-lg font-semibold mb-2">{b.title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">{b.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CARD VARIANTS */}
            <section className="py-16 sm:py-24 bg-[#0D1320]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div {...fadeUp} className="max-w-2xl mb-12">
                        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400 mb-3">Pilihan Kartu</p>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Dua varian premium. Satu kekuatan.</h2>
                        <p className="mt-4 text-slate-400">
                            Setiap kartu dilengkapi NFC chip dan QR Code yang mengarah ke URL Short Card Anda — dengan ruang untuk logo bisnis Anda.
                        </p>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { img: IMG_BLACK, name: "Short Card Black", desc: "Matte black premium dengan aksen putih. Tegas dan elegan.", testid: "card-variant-black" },
                            { img: IMG_WHITE, name: "Short Card White", desc: "Putih bersih minimalis. Cocok untuk brand yang lembut.", testid: "card-variant-white" },
                        ].map((v) => (
                            <motion.div
                                key={v.name}
                                {...fadeUp}
                                data-testid={v.testid}
                                className="group rounded-3xl overflow-hidden border border-slate-800 bg-[#131B2A]"
                            >
                                <div className="overflow-hidden">
                                    <img
                                        src={v.img}
                                        alt={v.name}
                                        className="w-full object-cover max-h-[50vh] md:max-h-80 group-hover:scale-[1.03] transition-transform duration-700"
                                        loading="lazy"
                                    />
                                </div>
                                <div className="p-6 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold">{v.name}</h3>
                                        <p className="text-sm text-slate-400 mt-1">{v.desc}</p>
                                    </div>
                                    <Link to="/activate">
                                        <span className="w-11 h-11 rounded-full border border-slate-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-600 transition-colors">
                                            <ArrowRight className="w-4 h-4" />
                                        </span>
                                    </Link>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* USE CASES */}
            <section id="gunakan-untuk" className="py-16 sm:py-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div {...fadeUp} className="max-w-2xl mb-12">
                        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400 mb-3">Gunakan Untuk</p>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Satu kartu untuk semua tujuan</h2>
                        <p className="mt-4 text-slate-400">Satu kartu memiliki satu tujuan utama yang aktif — dan bisa diubah kapan saja.</p>
                    </motion.div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {USE_CASES.map((u, i) => (
                            <motion.div
                                key={u.name}
                                {...fadeUp}
                                transition={{ ...fadeUp.transition, delay: i * 0.04 }}
                                data-testid={`usecase-${u.name.toLowerCase().replace(/\s+/g, "-")}`}
                                className={`rounded-2xl border border-slate-800 bg-[#131B2A] p-5 hover:border-slate-600 transition-colors ${i === 0 ? "col-span-2 sm:col-span-1 border-amber-500/30" : ""}`}
                            >
                                <u.icon className={`w-7 h-7 mb-4 ${u.color}`} />
                                <h3 className="font-semibold text-sm sm:text-base">{u.name}</h3>
                                <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">{u.desc}</p>
                            </motion.div>
                        ))}
                        <motion.div
                            {...fadeUp}
                            className="rounded-2xl border border-blue-500/40 bg-blue-600/10 p-5 flex flex-col justify-between"
                        >
                            <p className="text-sm font-semibold text-blue-300 leading-relaxed">Punya kartu? Aktifkan sekarang, gratis.</p>
                            <Link to="/activate" className="mt-4">
                                <span data-testid="usecase-activate-link" className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-400 hover:text-blue-300">
                                    Aktivasi Kartu <ArrowRight className="w-4 h-4" />
                                </span>
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section id="cara-kerja" className="py-16 sm:py-24 bg-[#0D1320]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div {...fadeUp} className="max-w-2xl mb-12">
                        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400 mb-3">Cara Kerja</p>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Empat langkah sederhana</h2>
                    </motion.div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {STEPS.map((s, i) => (
                            <motion.div key={s.num} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }} data-testid={`step-${i + 1}`} className="relative">
                                <p className="font-mono-code text-5xl font-semibold text-slate-800 mb-4">{s.num}</p>
                                <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* LIFETIME WARRANTY */}
            <section id="garansi" className="py-16 sm:py-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        {...fadeUp}
                        className="rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-[#131B2A] to-[#131B2A] p-8 sm:p-12 lg:p-16"
                    >
                        <div className="grid lg:grid-cols-2 gap-10 items-center">
                            <div>
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-wider mb-6">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Garansi Seumur Hidup
                                </div>
                                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-5">Lifetime Garansi Link</h2>
                                <p className="text-slate-300 leading-relaxed mb-4">
                                    Link bermasalah atau bisnis Anda pindah lokasi? <strong className="text-white">Tidak perlu beli kartu baru.</strong>
                                </p>
                                <p className="text-slate-400 leading-relaxed mb-8">
                                    Cukup ajukan koreksi link — kirim link terbaru dan alasannya. Link diperbarui dalam hitungan menit,
                                    QR Code dan NFC tetap sama, dan kartu langsung bisa digunakan seperti biasa.
                                </p>
                                <Link to="/correction">
                                    <button
                                        data-testid="warranty-correction-button"
                                        className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors"
                                    >
                                        Ajukan Koreksi Link <ArrowRight className="w-4 h-4" />
                                    </button>
                                </Link>
                            </div>
                            <div className="rounded-2xl border border-slate-700/60 bg-[#0B0F17] p-6 font-mono-code text-xs sm:text-sm leading-loose">
                                <p className="text-slate-500"># Prinsip Short Card</p>
                                <p><span className="text-blue-400">Card ID</span> <span className="text-slate-500">→</span> <span className="text-slate-300">SC-0001 (tetap selamanya)</span></p>
                                <p><span className="text-blue-400">QR Code</span> <span className="text-slate-500">→</span> <span className="text-slate-300">tidak perlu cetak ulang</span></p>
                                <p><span className="text-blue-400">NFC</span> <span className="text-slate-500">→</span> <span className="text-slate-300">tidak perlu ditulis ulang</span></p>
                                <p><span className="text-blue-400">Destination</span> <span className="text-slate-500">→</span> <span className="text-emerald-400">dapat diubah kapan saja</span></p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* CS CTA */}
            <section className="py-16 sm:py-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div {...fadeUp}>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">Butuh bantuan?</h2>
                        <p className="text-slate-400 mb-8 max-w-xl mx-auto">
                            Hubungi Customer Service Short Card untuk aktivasi, koreksi link, atau pertanyaan seputar kartu Anda.
                        </p>
                        <a
                            href={waLink(config)}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="cta-cs-whatsapp-button"
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all hover:shadow-[0_0_32px_rgba(16,185,129,0.4)]"
                        >
                            <MessageCircle className="w-5 h-5" />
                            Hubungi Customer Service
                        </a>
                    </motion.div>
                </div>
            </section>

            <PublicFooter />
        </div>
    );
}
