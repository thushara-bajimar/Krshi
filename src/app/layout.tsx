import type { Metadata, Viewport } from "next";
// Self-hosted fonts (no network needed at build time; cached by the service worker for offline use).
// The browser only downloads the unicode subsets actually used on a page.
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "@fontsource/noto-sans-kannada/400.css";
import "@fontsource/noto-sans-kannada/500.css";
import "@fontsource/noto-sans-kannada/600.css";
import { Toaster } from "sonner";
import "./globals.css";


export const metadata: Metadata = {
  title: { default: "KRSHI — farm records, prices and weather for coastal Karnataka", template: "%s · KRSHI" },
  description: "KRSHI helps farmers in Dakshina Kannada and Udupi keep farm records, track labour and expenses, follow market prices and weather, and find government schemes.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "KRSHI", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#1c3520", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ className: "font-sans" }} />
      </body>
    </html>
  );
}
