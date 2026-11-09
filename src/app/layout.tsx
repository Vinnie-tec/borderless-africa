import type { Metadata } from "next";
import { Inter, Roboto } from "next/font/google";
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
  title: "Borderless Africa || Agboola Vincent",
  description: "A fresh canvas for ideas without borders.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-lt-installed="true"
      data-new-gr-c-s-check-loaded="14.1345.0"
      data-gr-ext-installed=""
    >
      <body
        className={`${inter.variable} ${roboto.variable}`}
        data-new-gr-c-s-check-loaded="14.1345.0"
        data-gr-ext-installed=""
      >
        {children}
      </body>
    </html>
  );
}
