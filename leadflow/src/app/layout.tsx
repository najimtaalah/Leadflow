import type { Metadata } from "next";
import "./globals.css";
import { ToasterClient } from "@/components/ui/toaster-client";

export const metadata: Metadata = {
  title: "LeadFlow — CRM Formation",
  description: "Gestion apprenants & formations Qualiopi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased" suppressHydrationWarning>
      <body className="h-full">
        {children}
        <ToasterClient />
      </body>
    </html>
  );
}
