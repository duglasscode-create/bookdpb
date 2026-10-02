import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#1a1d29",
};

export const metadata: Metadata = {
  title: "BookDPB",
  description: "Tus spaces, carpetas y marcadores en la web",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BookDPB",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
