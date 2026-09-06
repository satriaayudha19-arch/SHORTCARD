import { useState } from "react";
import { Link } from "react-router-dom";
import { Nfc, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV_LINKS = [
    { href: "/#fitur", label: "Fitur" },
    { href: "/#cara-kerja", label: "Cara Kerja" },
    { href: "/#gunakan-untuk", label: "Gunakan Untuk" },
    { href: "/#garansi", label: "Garansi" },
];

export default function PublicNav() {
    const [open, setOpen] = useState(false);

    return (
        <header className="fixed top-0 inset-x-0 z-50 glass-panel border-b border-slate-800/60" data-testid="public-nav">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2.5" data-testid="nav-logo-link">
                    <span className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                        <Nfc className="w-5 h-5 text-white" />
                    </span>
                    <span className="leading-tight">
                        <span className="block font-extrabold tracking-tight text-slate-50">Short Card</span>
                        <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">by GlobalConnex</span>
                    </span>
                </Link>

                <nav className="hidden lg:flex items-center gap-8">
                    {NAV_LINKS.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            data-testid={`nav-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
                        >
                            {link.label}
                        </a>
                    ))}
                    <Link
                        to="/admin/login"
                        data-testid="nav-admin-link"
                        className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
                    >
                        Masuk Admin
                    </Link>
                </nav>

                <div className="flex items-center gap-3">
                    <Link to="/activate" className="hidden sm:block">
                        <Button
                            data-testid="nav-activate-button"
                            className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5"
                        >
                            Aktifkan Kartu
                        </Button>
                    </Link>
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <button
                                data-testid="nav-mobile-menu-button"
                                className="lg:hidden w-11 h-11 flex items-center justify-center rounded-xl border border-slate-700 text-slate-200"
                                aria-label="Buka menu"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                        </SheetTrigger>
                        <SheetContent side="right" className="bg-[#0B0F17] border-slate-800 text-slate-100 w-72">
                            <nav className="flex flex-col gap-5 mt-10">
                                {NAV_LINKS.map((link) => (
                                    <a
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setOpen(false)}
                                        className="text-lg font-semibold text-slate-200"
                                    >
                                        {link.label}
                                    </a>
                                ))}
                                <Link to="/admin/login" onClick={() => setOpen(false)} className="text-lg font-semibold text-slate-400">
                                    Masuk Admin
                                </Link>
                                <Link to="/activate" onClick={() => setOpen(false)}>
                                    <Button className="w-full rounded-full bg-blue-600 hover:bg-blue-500 font-semibold mt-4">
                                        Aktifkan Kartu
                                    </Button>
                                </Link>
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}
