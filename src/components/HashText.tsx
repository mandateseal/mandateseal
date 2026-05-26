export function HashText({
  value,
  label,
  prefix,
}: {
  value: string;
  label?: string;
  prefix?: string;
}) {
  const shown = prefix && !value.startsWith(prefix) ? prefix + value : value;
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="label">{label}</span>}
      <code className="font-tech text-[12px] text-paper break-all leading-relaxed">{shown}</code>
    </div>
  );
}
