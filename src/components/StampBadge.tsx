type Status = "APPROVED" | "BLOCKED" | "NEEDS_APPROVAL";

const map: Record<Status, { cls: string; label: string }> = {
  APPROVED: { cls: "stamp-approved", label: "APPROVED" },
  BLOCKED: { cls: "stamp-blocked", label: "BLOCKED" },
  NEEDS_APPROVAL: { cls: "stamp-approval", label: "NEEDS APPROVAL" },
};

export function StampBadge({ status }: { status: Status }) {
  const v = map[status];
  return <span className={`stamp-badge ${v.cls}`}>{v.label}</span>;
}
