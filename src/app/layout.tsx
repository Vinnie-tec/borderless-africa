import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Borderless Africa || Agboola Vincent",
  description: "",
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
      <body data-new-gr-c-s-check-loaded="14.1345.0" data-gr-ext-installed="">
        {children}
      </body>
    </html>
  );
}
