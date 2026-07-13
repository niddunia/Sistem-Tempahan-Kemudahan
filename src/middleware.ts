/**
 * Security headers middleware for Sistem e-Tempahan PLTT-JTM.
 * PRD §10 Keselamatan: TLS 1.2+, AES-256, audit logs, PDPA compliance.
 * Adds CSP, X-Frame-Options (clickjacking), X-Content-Type-Options (MIME sniffing),
 * Referrer-Policy, Permissions-Policy, and HSTS.
 *
 * NOTE: Per project constraint, only the / route is exposed to users; all
 * other paths (e.g. /api/*) are still allowed for the SPA's data layer.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // ── Security headers ────────────────────────────────────────────────────
  // CSP: allow same-origin + inline (Next.js requires) + data: images + Google Fonts for icons
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
  res.headers.set('Content-Security-Policy', csp);

  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('X-DNS-Prefetch-Control', 'on');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  // PDPA / classification banner hint
  res.headers.set('X-Content-Classification', 'SULIT-JTM-INTERNAL');

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
