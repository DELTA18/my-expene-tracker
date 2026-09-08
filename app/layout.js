import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import RegisterServiceWorker from "./register-sw";

const fontSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const fontMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const fontDisplay = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata = {
  title: "Pocket Ledger",
  description: "A simple expense tracker for logging spending in seconds.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pocket Ledger",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDEEE6" },
    { media: "(prefers-color-scheme: dark)", color: "#13160F" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} ${fontDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          // Runs before paint so a stored light/dark override applies
          // immediately, instead of flashing system-default theme first
          // while Firebase auth/Firestore are still resolving the real
          // preference. Mirrors lib/theme.js's applyTheme, kept inline since
          // it can't import a module.
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.classList.add(t);}}catch(e){}})();',
          }}
        />
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
