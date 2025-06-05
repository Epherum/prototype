// src/middleware.ts
export { default } from "next-auth/middleware";

export const config = {
  // matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"], // More complex matcher
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (the login page itself)
     * - Any other public assets (e.g., /images/, /public/)
     */
    "/((?!api|_next/static|_next/image|assets|favicon.ico|login).*)",
  ],
};
