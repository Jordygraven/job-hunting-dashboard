import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthorized } from "@/lib/auth/basicAuth";

export function proxy(request: NextRequest) {
  if (isAuthorized(request.headers.get("authorization"), process.env.DASHBOARD_PASSWORD)) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Job Hunting Dashboard"' },
  });
}

export const proxyConfig = {
  matcher: ["/((?!api/sync|_next/static|_next/image|favicon.ico).*)"],
};
