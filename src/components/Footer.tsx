export function Footer() {
  return (
    <footer className="border-t border-line mt-16">
      <div className="page-container py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <span className="font-tech text-[10px] uppercase tracking-[0.2em] text-paperMuted">
          MandateSeal MVP · localhost
        </span>
        <span className="font-tech text-[10px] uppercase tracking-[0.2em] text-paperMuted">
          trust is a log, not a promise.
        </span>
      </div>
    </footer>
  );
}
