export default function manifest() {
  return {
    name: "Pocket Ledger",
    short_name: "Ledger",
    description: "A simple expense tracker — log spending in seconds.",
    start_url: "/",
    display: "standalone",
    background_color: "#EDEEE6",
    theme_color: "#B87A16",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
