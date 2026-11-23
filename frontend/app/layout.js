import Link from "next/link";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = {
  title: "Student Performance Predictor",
  description: "Predict a student's final grade with machine learning",
};

// Applies the saved theme before the page paints (avoids a white flash)
const themeScript = `
try {
  var saved = localStorage.getItem("theme");
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (!saved && prefersDark)) document.documentElement.classList.add("dark");
} catch (e) {}
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <header className="border-b border-slate-200 dark:border-slate-700">
          <nav className="mx-auto flex max-w-5xl items-center justify-between p-4">
            <span className="font-bold">Grade Predictor</span>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/" className="hover:underline">Predict</Link>
              <Link href="/performance" className="hover:underline">Model performance</Link>
              <ThemeToggle />
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl p-4">{children}</main>
      </body>
    </html>
  );
}
