import type { Metadata } from "next";
import { Inter, Roboto } from "next/font/google";
import { ToastProvider } from "@/components/toast/toast-provider";

import "./globals.scss";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Borderless Africa | Work without borders",
  description:
    "Find meaningful work, connect with brilliant people, and build opportunities across Africa and beyond.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-lt-installed="true"
      data-new-gr-c-s-check-loaded="14.1347sss.0"
      data-gr-ext-installed=""
    >
      <body
        className={`${inter.variable} ${roboto.variable}`}
        data-new-gr-c-s-check-loaded="14.1345.0"
        data-gr-ext-installed=""
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}