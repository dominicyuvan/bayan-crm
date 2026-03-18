import type { Metadata } from "next";
import "./globals.css";
import { DM_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { FirestoreProvider } from "@/lib/firestore-provider";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bayan CRM",
  description: "Sales CRM for Bayan Investment (Muscat, Oman)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>
            <FirestoreProvider>{children}</FirestoreProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
