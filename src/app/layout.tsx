import type { Metadata } from "next";
import { Archivo_Black, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider, ThemeScript } from "@/lib/theme";
import { DialogProvider } from "@/components/dialog";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

const archivo = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "Zaffarology, 5 Pillars",
  // Five, not eight: the folder and the App Store listing keep the old name,
  // the app itself does not.
  description: "Master your mind, build your legacy. The 5 success pillars.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: ThemeScript sets `data-theme` on this element
    // before React hydrates, so the server's markup deliberately differs.
    <html
      lang="en"
      className={`${inter.variable} ${archivo.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>
          <DialogProvider>
            <AuthProvider>{children}</AuthProvider>
          </DialogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
