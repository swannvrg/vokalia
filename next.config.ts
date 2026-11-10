import type { NextConfig } from "next";

const windowsBuildOptions =
  process.platform === "win32"
    ? {
        staticGenerationMaxConcurrency: 1,
        staticGenerationMinPagesPerWorker: 35,
      }
    : undefined;

const nextConfig: NextConfig = {
  ...(windowsBuildOptions ? { experimental: windowsBuildOptions } : {}),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "script-src 'self' https://challenges.cloudflare.com",
              "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com",
              "frame-src https://challenges.cloudflare.com",
              "img-src 'self' data: blob: https://*.supabase.co",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
