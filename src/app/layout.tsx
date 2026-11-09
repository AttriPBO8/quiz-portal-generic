import type { Metadata, Viewport } from "next";
import { APP_NAME, COPYRIGHT } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Timed quizzes for teachers, workers and helpers.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Applies the saved color scheme and dark mode before the page paints, so it never flashes.
const themeScript = `try{var t=JSON.parse(localStorage.getItem("qp_theme")||"{}");var m=t.mode||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.mode=m;document.documentElement.dataset.scheme=t.scheme||"blue";}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light" data-scheme="blue" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh flex flex-col font-sans antialiased">
        <div className="flex-1 flex flex-col">{children}</div>
        <footer className="border-t border-border py-4 text-center text-sm text-muted">
          © {new Date().getFullYear()} {COPYRIGHT} All rights reserved.
        </footer>
      </body>
    </html>
  );
}
