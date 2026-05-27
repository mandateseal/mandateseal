import { LoginForm } from "@/components/LoginForm";
import { isAuthEnabled } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const authOn = isAuthEnabled();
  return (
    <div className="page-container py-24 max-w-md mx-auto">
      {authOn ? (
        <>
          <LoginForm next={searchParams.next ?? "/dashboard"} />
          <p className="mt-4 font-tech text-[10px] uppercase tracking-[0.22em] text-paperMuted text-center">
            no gas · no transaction · session 7 days
          </p>
        </>
      ) : (
        <div className="border border-line bg-ink/95 font-tech text-paper">
          <div className="border-b border-line px-4 py-2.5 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.22em] text-amber">
              &gt; mandateseal auth · disabled
            </span>
          </div>
          <div className="px-4 py-4 text-[12px] text-paper leading-relaxed">
            <code className="text-amber">MANDATESEAL_ADMIN_ADDRESSES</code> is not set.
            dashboard is open to anyone with network access. set the env var to a
            comma-separated address allowlist to enforce siwe login.
          </div>
        </div>
      )}
    </div>
  );
}
