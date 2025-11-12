import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CallSense - Intelligent Call Detection and Management",
  description:
    "CallSense leverages AI to detect and manage your calls effectively. Identify humans vs. machines, log call details, and optimize your communication strategy with ease.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased dark:bg-gray-950 dark:text-white`}
      >
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            className: "dark:bg-gray-800 dark:text-white",
          }}
        />
      </body>
    </html>
  );
}
