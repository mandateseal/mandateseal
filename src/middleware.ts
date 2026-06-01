import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/admin-auth";

const PROTECTED_PAGE_PATHS = [
  /^\/dashboard(\/|$)/,
  /^\/agents(\/|$)/,
  /^\/mandates(\/|$)/,
  /^\/receipts(\/|$)/,
  /^\/approvals(\/|$)/,
  /^\/audit(\/|$)/,
  /^\/spend(\/|$)/,
  /^\/tools(\/|$)/,
  /^\/webhooks(\/|$)/,
  /^\/anchor(\/|$)/,
];

const PROTECTED_API_PATHS = [
  /^\/api\/agents(\/|$)/,
  /^\/api\/mandates(\/|$)/,
  /^\/api\/receipts(\/|$)/,
  /^\/api\/approvals(\/|$)/,
  /^\/api\/audit(\/|$)/,
  /^\/api\/tools(\/|$)/,
  /^\/api\/webhooks(\/|$)/,
  /^\/api\/anchor(\/|$)/,
];

const PROTECTED_API_METHODS = new Set(["POST", "PATCH", "DELETE"]);
const PROTECTED_API_GET_PATHS = [
  /^\/api\/agents$/,
  /^\/api\/mandates$/,
  /^\/api\/receipts$/,
  /^\/api\/approvals$/,
  /^\/api\/audit\/integrity$/,
  /^\/api\/audit\/stats$/,
  /^\/api\/audit\/spend$/,
  /^\/api\/tools$/,
  /^\/api\/webhooks$/,
  /^\/api\/webhooks\/[^/]+\/deliveries$/,
  /^\/api\/anchor$/,
  /^\/api\/anchor\/proof$/,
  /^\/api\/anchor\/audit$/,
];

// Routes that stay public even when they live under an otherwise-protected
// prefix. Stateless compute (anchor proof verify) and the bearer-authed agent
// proxy fall here.
const ALWAYS_PUBLIC_API_PATHS = [
  /^\/api\/anchor\/verify$/,
  // v0.8.5 — wallet ownership proof. The SIWE signature is the auth (you can
  // only verify a wallet you control), so it must bypass the admin-cookie gate.
  /^\/api\/mandates\/[^/]+\/verify-wallet$/,
];

// /api/proxy/:tool is bearer-auth (agent calls), not admin-cookie auth — so we
// exclude it from PROTECTED_API_PATHS even though POST mutates upstream state.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;

  if (ALWAYS_PUBLIC_API_PATHS.some((rx) => rx.test(pathname))) {
    return NextResponse.next();
  }

  const isProtectedPage = PROTECTED_PAGE_PATHS.some((rx) => rx.test(pathname));
  const isMutatingApi =
    PROTECTED_API_METHODS.has(req.method) &&
    PROTECTED_API_PATHS.some((rx) => rx.test(pathname));
  const isReadingProtectedApi =
    req.method === "GET" && PROTECTED_API_GET_PATHS.some((rx) => rx.test(pathname));

  if (!isProtectedPage && !isMutatingApi && !isReadingProtectedApi) {
    return NextResponse.next();
  }
  if (await isValidSession(cookie)) {
    return NextResponse.next();
  }
  if (isProtectedPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agents/:path*",
    "/mandates/:path*",
    "/receipts/:path*",
    "/approvals/:path*",
    "/audit/:path*",
    "/spend/:path*",
    "/tools/:path*",
    "/webhooks/:path*",
    "/anchor/:path*",
    "/api/:path*",
  ],
};
