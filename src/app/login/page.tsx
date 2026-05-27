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
    <div className="page-container py-20 max-w-md">
      <div className="label">CONTROL CONSOLE</div>
      <h1 className="display-title text-paper text-3xl mt-2">SIGN IN</h1>
      {authOn ? (
        <>
          <p className="mt-2 text-paperMuted text-sm">
            Connect wallet to continue. No gas.
          </p>
          <div className="mt-8">
            <LoginForm next={searchParams.next ?? "/dashboard"} />
          </div>
        </>
      ) : (
        <div className="mt-6 paper-panel p-5">
          <div className="label text-amber">⚠ AUTH DISABLED</div>
          <p className="mt-2 text-paper text-sm">
            <code>MANDATESEAL_ADMIN_ADDRESSES</code> is not set. Dashboard is open to anyone with
            network access. Set the env var to a comma-separated address allowlist to enforce SIWE login.
          </p>
        </div>
      )}
    </div>
  );
}
