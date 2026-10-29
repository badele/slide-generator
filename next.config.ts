import type { NextConfig } from 'next';

const securityHeaders = [
  // Prevent embedding in iframes (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Limit referrer information sent to third parties
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Remove Next.js fingerprint
  { key: 'X-Powered-By', value: '' },
  // CSP: allow same-origin scripts/styles (Next.js needs unsafe-inline for hydration),
  // images from self + data URIs (for embedded previews), connect to self only.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  outputFileTracingIncludes: {
    '/api/generate':         ['./profiles/**/*', './resources/fonts/**/*'],
    '/api/preview':          ['./profiles/**/*', './resources/fonts/**/*'],
    '/api/templates':        ['./profiles/**/*'],
    '/api/templates/[name]': ['./profiles/**/*'],
    '/api/validate':         ['./profiles/**/*'],
    '/view/[id]':            ['./profiles/**/*', './resources/fonts/**/*'],
    '/api/generate-share/[id]': ['./profiles/**/*', './resources/fonts/**/*'],
    '/api/font-file/[filename]': ['./resources/fonts/**/*'],
    '/':                         ['./fonts.yaml'],
  },
};

export default nextConfig;
