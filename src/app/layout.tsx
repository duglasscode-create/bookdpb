import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookDPB",
  description: "Tus spaces, carpetas y marcadores en la web",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
