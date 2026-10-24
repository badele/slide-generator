import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/generate':         ['./profiles/**/*', './resources/fonts/**/*'],
    '/api/preview':          ['./profiles/**/*', './resources/fonts/**/*'],
    '/api/templates':        ['./profiles/**/*'],
    '/api/templates/[name]': ['./profiles/**/*'],
    '/api/validate':         ['./profiles/**/*'],
  },
};

export default nextConfig;
