import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import { ThemeProvider } from "@/app/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Fan Funding | Sui",
  description: "Decentralized fan funding platform on Sui — mint NFTs and support creators with SUI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <Providers>
            <div className="min-h-screen bg-background dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
              <Navbar />
              <PageTransitionWrapper>{children}</PageTransitionWrapper>
              <Toaster />
              <BottomNav />
            </div>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
