import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import ToastHost from "@/components/ToastHost";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Tavernfire",
  description:
    "Light a fire with three sparks and get something for your table. A library of NPCs, locations, items and creatures written by people.",
};

// Runs before the page paints so the saved theme never flashes the wrong colours.
// Dark is the default.
const THEME_SCRIPT = `try{var t=localStorage.getItem("tf-theme");var l=t==="light"||(t==="system"&&window.matchMedia("(prefers-color-scheme: light)").matches);document.documentElement.dataset.theme=l?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AuthProvider>
          <NotificationsProvider>
            <SiteHeader />
            {children}
            <SiteFooter />
            <ToastHost />
          </NotificationsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
