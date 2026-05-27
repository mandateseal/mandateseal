// Editorial-style stat panel: label + big display number.
// Used across /receipts, /audit, IntegrityCard. Variants pick which panel
// shell to use (ink for inside cards, paper for inside ink-panels).

export function StatTile({
  label,
  value,
  tone = "text-paper",
  variant = "ink",
}: {
  label: string;
  value: number | string;
  tone?: string;
  variant?: "ink" | "paper" | "bare";
}) {
  const inner = (
    <>
      <div className="label">{label}</div>
      <div className={`mt-1 font-display text-2xl tracking-[0.04em] ${tone}`}>{value}</div>
    </>
  );
  if (variant === "bare") return <div>{inner}</div>;
  if (variant === "paper") return <div className="paper-panel p-3">{inner}</div>;
  return <div className="ink-panel p-4">{inner}</div>;
}
