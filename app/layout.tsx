import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { APP_FONT_STORAGE_KEY, parseAppFont } from "@/lib/app-font";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sfPro = localFont({
  src: [
    {
      path: "../external/fonts/sf_pro/SFPRODISPLAYREGULAR.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../external/fonts/sf_pro/SFProText-Heavy.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sf-pro",
  display: "swap",
});

const euclidCircular = localFont({
  src: "../external/fonts/euclidic circualar/Euclid Circular A Light.ttf",
  variable: "--font-euclid-circular",
  display: "swap",
  weight: "300",
});

export const metadata: Metadata = {
  title: "Todolist",
  description: "A simple todo list app",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const appFont = parseAppFont(cookieStore.get(APP_FONT_STORAGE_KEY)?.value);

  return (
    <html
      lang="en"
      data-app-font={appFont}
      className={`${inter.variable} ${sfPro.variable} ${euclidCircular.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
