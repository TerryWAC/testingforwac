/**
 * Security headers.
 *
 * The app renders user-supplied text (film titles, reviews) and stores avatars
 * as inline data URLs, so the defaults are worth tightening before it goes
 * public. No full CSP here on purpose: Next's runtime needs inline scripts,
 * and a policy carrying 'unsafe-inline' buys nothing while making the config
 * look safer than it is. Framing, sniffing and referrer leakage are the ones
 * that actually pay off.
 */
const securityHeaders = [
  // Nobody should be embedding this app in an iframe.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Don't let the browser second-guess declared content types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin off-site, never the full path — join codes live in URLs.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here needs any of these.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
