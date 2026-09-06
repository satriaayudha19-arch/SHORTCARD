import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";

import LandingPage from "@/pages/public/LandingPage";
import ActivatePage from "@/pages/public/ActivatePage";
import CorrectionPage from "@/pages/public/CorrectionPage";
import RedirectPage from "@/pages/public/RedirectPage";

import AdminLogin from "@/pages/admin/AdminLogin";
import AdminLayout from "@/pages/admin/AdminLayout";
import DashboardPage from "@/pages/admin/DashboardPage";
import CardsPage from "@/pages/admin/CardsPage";
import CardDetailPage from "@/pages/admin/CardDetailPage";
import BusinessesPage from "@/pages/admin/BusinessesPage";
import CorrectionsPage from "@/pages/admin/CorrectionsPage";
import HistoryPage from "@/pages/admin/HistoryPage";
import SettingsPage from "@/pages/admin/SettingsPage";

function NotFound() {
    return (
        <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col items-center justify-center px-6 text-center">
            <p className="text-xs tracking-[0.3em] uppercase text-slate-500 mb-4">Short Card · GlobalConnex</p>
            <h1 className="text-3xl font-bold mb-3" data-testid="not-found-title">Halaman Tidak Ditemukan</h1>
            <p className="text-slate-400 mb-8">Halaman yang Anda cari tidak tersedia.</p>
            <a href="/" data-testid="not-found-home-link" className="px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 font-semibold transition-colors">
                Kembali ke Beranda
            </a>
        </div>
    );
}

function App() {
    return (
        <div className="App">
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/activate" element={<ActivatePage />} />
                        <Route path="/aktivasi" element={<Navigate to="/activate" replace />} />
                        <Route path="/correction" element={<CorrectionPage />} />
                        <Route path="/koreksi" element={<Navigate to="/correction" replace />} />
                        <Route path="/r/:code" element={<RedirectPage />} />
                        <Route path="/admin/login" element={<AdminLogin />} />
                        <Route path="/admin" element={<AdminLayout />}>
                            <Route index element={<DashboardPage />} />
                            <Route path="cards" element={<CardsPage />} />
                            <Route path="cards/:code" element={<CardDetailPage />} />
                            <Route path="businesses" element={<BusinessesPage />} />
                            <Route path="corrections" element={<CorrectionsPage />} />
                            <Route path="history" element={<HistoryPage />} />
                            <Route path="settings" element={<SettingsPage />} />
                        </Route>
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </BrowserRouter>
                <Toaster position="top-center" richColors />
            </AuthProvider>
        </div>
    );
}

export default App;
