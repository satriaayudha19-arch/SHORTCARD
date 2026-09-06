import { Badge } from "@/components/ui/badge";

const CARD_STYLES = {
    ACTIVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
    ASSIGNED: "bg-blue-100 text-blue-700 border-blue-200",
    UNASSIGNED: "bg-amber-100 text-amber-700 border-amber-200",
    DISABLED: "bg-red-100 text-red-700 border-red-200",
};

const CORRECTION_STYLES = {
    PENDING: "bg-violet-100 text-violet-700 border-violet-200",
    REVIEWING: "bg-blue-100 text-blue-700 border-blue-200",
    APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-100 text-red-700 border-red-200",
};

export const STATUS_LABELS = {
    ACTIVE: "Aktif",
    ASSIGNED: "Diberikan",
    UNASSIGNED: "Belum Digunakan",
    DISABLED: "Nonaktif",
    PENDING: "Menunggu",
    REVIEWING: "Ditinjau",
    APPROVED: "Disetujui",
    COMPLETED: "Selesai",
    REJECTED: "Ditolak",
};

export function StatusBadge({ status, type = "card", testid }) {
    const styles = type === "correction" ? CORRECTION_STYLES : CARD_STYLES;
    return (
        <Badge
            data-testid={testid || `status-badge-${(status || "").toLowerCase()}`}
            variant="outline"
            className={`${styles[status] || "bg-slate-100 text-slate-600"} font-semibold border`}
        >
            {STATUS_LABELS[status] || status}
        </Badge>
    );
}
