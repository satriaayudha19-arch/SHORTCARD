import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import {
    Nfc, LayoutDashboard, CreditCard, Building2, FileEdit, History, Settings, LogOut, Menu,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const MENU = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, testid: "admin-sidebar-dashboard-link" },
    { to: "/admin/cards", label: "Kartu", icon: CreditCard, testid: "admin-sidebar-cards-link" },
    { to: "/admin/businesses", label: "Bisnis", icon: Building2, testid: "admin-sidebar-businesses-link" },
    { to: "/admin/corrections", label: "Koreksi Link", icon: FileEdit, testid: "admin-sidebar-corrections-link" },
    { to: "/admin/history", label: "Riwayat", icon: History, testid: "admin-sidebar-history-link" },
    { to: "/admin/settings", label: "Pengaturan", icon: Settings, testid: "admin-sidebar-settings-link" },
];

function NavItems({ onNavigate }) {
    return (
        <nav className="flex flex-col gap-1">
            {MENU.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    data-testid={item.testid}
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                            isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                        }`
                    }
                >
                    <item.icon className="w-4.5 h-4.5 w-5 h-5" />
                    {item.label}
                </NavLink>
            ))}
        </nav>
    );
}

export default function AdminLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    if (user === null) {
        return (
            <div className="min-h-screen bg-slate-100 p-8 space-y-4" data-testid="admin-loading">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }
    if (user === false) return <Navigate to="/admin/login" replace />;

    const handleLogout = async () => {
        await logout();
        navigate("/admin/login", { replace: true });
    };

    return (
        <div className="min-h-screen bg-slate-100 flex" data-testid="admin-layout">
            {/* Sidebar desktop */}
            <aside className="hidden lg:flex flex-col w-64 bg-[#0F172A] text-white p-5 fixed inset-y-0">
                <div className="flex items-center gap-2.5 mb-8 px-2">
                    <span className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                        <Nfc className="w-5 h-5 text-white" />
                    </span>
                    <span className="leading-tight">
                        <span className="block font-extrabold tracking-tight text-sm">Short Card</span>
                        <span className="block text-[9px] uppercase tracking-[0.2em] text-slate-500">Admin · GlobalConnex</span>
                    </span>
                </div>
                <NavItems />
                <button
                    onClick={handleLogout}
                    data-testid="admin-logout-button"
                    className="mt-auto flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                    <LogOut className="w-5 h-5" /> Keluar
                </button>
            </aside>

            {/* Mobile topbar */}
            <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-[#0F172A] text-white h-14 flex items-center justify-between px-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                        <Nfc className="w-4 h-4 text-white" />
                    </span>
                    <span className="font-extrabold text-sm">Short Card Admin</span>
                </div>
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <button data-testid="admin-mobile-menu-button" className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-700" aria-label="Menu admin">
                            <Menu className="w-5 h-5" />
                        </button>
                    </SheetTrigger>
                    <SheetContent side="left" className="bg-[#0F172A] border-slate-800 text-white w-64">
                        <div className="mt-8">
                            <NavItems onNavigate={() => setOpen(false)} />
                            <button
                                onClick={handleLogout}
                                className="mt-6 w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60"
                            >
                                <LogOut className="w-5 h-5" /> Keluar
                            </button>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 min-h-screen">
                <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
