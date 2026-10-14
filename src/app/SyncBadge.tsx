import type { SyncStatus } from "@/lib/sync/syncStatus";

const BADGE: Record<SyncStatus, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-status-success-bg text-status-success-fg" },
  warning: { label: "Warning", className: "bg-status-warning-bg text-status-warning-fg" },
  error: { label: "Error", className: "bg-status-rejected-bg text-status-rejected-fg" },
};

export function SyncBadge({ status }: { status: SyncStatus }) {
  const { label, className } = BADGE[status];
  return <span className={`rounded-md px-2 py-0.5 text-xs ${className}`}>{label}</span>;
}
