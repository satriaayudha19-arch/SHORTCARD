import { Link } from "react-router-dom";
import { Nfc, MessageCircle } from "lucide-react";
import { usePublicConfig, waLink } from "@/hooks/usePublicConfig";

export default function PublicFooter() {
    const config = usePublicConfig();

    return (
        <footer className="border-t border-slate-800/60 bg-[#080C13]" data-testid="public-footer">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    <div>
                        <div className="flex items-center gap-2.5 mb-4">
                            <span className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                                <Nfc className="w-5 h-5 text-white" />
                            </span>
                            <span className="leading-tight">
                                <span className="block font-extrabold tracking-tight text-slate-50">Short Card</span>
                                <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">by GlobalConnex</span>
                            </span>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                            Kartu NFC + QR Code cerdas untuk menghubungkan pelanggan ke Google Review dan media sosial bisnis Anda.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Tautan Cepat</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link to="/activate" data-testid="footer-activate-link" className="text-slate-400 hover:text-white transition-colors">Aktivasi Kartu</Link></li>
                            <li><Link to="/correction" data-testid="footer-correction-link" className="text-slate-400 hover:text-white transition-colors">Ajukan Koreksi Link</Link></li>
                            <li><a href="/#fitur" className="text-slate-400 hover:text-white transition-colors">Fitur</a></li>
                            <li><a href="/#garansi" className="text-slate-400 hover:text-white transition-colors">Lifetime Garansi Link</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Butuh Bantuan?</h4>
                        <p className="text-sm text-slate-400 mb-4">Tim Customer Service Short Card siap membantu Anda.</p>
                        <a
                            href={waLink(config, "Halo CS Short Card, saya butuh bantuan.")}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="footer-cs-whatsapp-button"
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Hubungi Customer Service
                        </a>
                    </div>
                </div>
                <div className="mt-12 pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">© {new Date().getFullYear()} Short Card by GlobalConnex. Seluruh hak cipta dilindungi.</p>
                    <p className="text-xs text-slate-600">globalconnex.id/shortcard</p>
                </div>
            </div>
        </footer>
    );
}
