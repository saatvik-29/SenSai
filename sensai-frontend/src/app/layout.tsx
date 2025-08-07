import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/providers/SessionProvider";
import VapiWidget from "@/hooks/Vapi";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SensAI",
  description: "The only LMS you need in the era of AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans text-base`}
      >
        <SessionProvider>{children}</SessionProvider>
                               <VapiWidget
  apiKey="8ae8703e-8d2c-41af-8d42-75cd36ef6e02" 
  assistantId="480118e1-5898-4f70-8210-ed0715a5a481" 
/>
      </body>
    </html>
  );
}
