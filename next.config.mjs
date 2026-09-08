/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // same-origin-allow-popups (not the stricter same-origin) — Firebase's
        // signInWithPopup polls window.closed on the Google sign-in popup to
        // know when it's done; same-origin blocks that cross-origin check and
        // logs "Cross-Origin-Opener-Policy policy would block the window.closed
        // call" even though sign-in still completes.
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
