import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "docsParity — find where your docs and code drift apart";
const DESCRIPTION =
  "Point docsParity at a GitHub repo and a docs site. It finds where the code and the docs no longer match — and tells you exactly what to fix.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: process.env.NEXT_PUBLIC_BASE_URL
    ? new URL(process.env.NEXT_PUBLIC_BASE_URL)
    : undefined,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="mx-auto flex min-h-dvh max-w-4xl flex-col px-4 py-6 sm:px-6">
          <header className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold text-zinc-100"
            >
              <span className="grid size-7 place-items-center rounded-md bg-emerald-500 text-sm font-bold text-emerald-950">
                ◑
              </span>
              <span>
                docs<span className="text-emerald-400">Parity</span>
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm text-zinc-400 hover:text-zinc-200"
              >
                Dashboard
              </Link>
              <a
                href="https://github.com/reetbatra/docs-drift-detector"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-zinc-400 hover:text-zinc-200"
              >
                GitHub ↗
              </a>
            </div>
          </header>

          <main className="flex-1 py-8">{children}</main>

          <footer className="border-t border-zinc-900 pt-5 text-center text-xs text-zinc-600">
            docsParity · code vs docs, diffed by Claude in ~30 seconds.
          </footer>
        </div>
      </body>
    </html>
  );
}
