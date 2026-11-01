import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Poppins } from "next/font/google";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
});

export const viewport: Viewport = {
  themeColor: "#141006",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Becca's Crown Beauty Vault | Studio Dashboard & Booking",
  description: "Premier beauty, makeup, lash artistry, hair, and aesthetics in Ghana.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Crown Dashboard",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jakartaSans.variable} ${poppins.variable} font-sans h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Early capture of beforeinstallprompt to ensure it is never missed by late hydration
              window.__pwaInstallPrompt = null;
              window.addEventListener('beforeinstallprompt', function(e) {
                e.preventDefault();
                window.__pwaInstallPrompt = e;
                window.dispatchEvent(new CustomEvent('pwa-prompt-available', { detail: e }));
              });

              // Immediate Service Worker Registration with active update
              if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function(reg) {
                  reg.update();
                }).catch(function(err) {
                  console.debug('ServiceWorker notice:', err);
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full w-full max-w-full overflow-x-hidden bg-swirl text-[#1E1E1E] flex flex-col">
        {children}
      </body>
    </html>
  );
}
