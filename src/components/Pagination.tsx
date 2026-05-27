"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function Pagination({
  total,
  limit,
  offset,
}: {
  total: number;
  limit: number;
  offset: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  const go = (nextOffset: number) => {
    const params = new URLSearchParams(search?.toString() ?? "");
    if (nextOffset > 0) params.set("offset", String(nextOffset));
    else params.delete("offset");
    router.replace(`${pathname}?${params.toString()}`);
  };

  if (total <= limit) return null;

  return (
    <div className="mt-4 flex items-center justify-between font-tech text-[11px] text-paperMuted uppercase tracking-[0.18em]">
      <div>
        page {page} of {totalPages} · showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
      </div>
      <div className="flex gap-2">
        <button
          className="command-button"
          disabled={!canPrev}
          onClick={() => go(Math.max(0, offset - limit))}
        >
          Prev
        </button>
        <button
          className="command-button"
          disabled={!canNext}
          onClick={() => go(offset + limit)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
