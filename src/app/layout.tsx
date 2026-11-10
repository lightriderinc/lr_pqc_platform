import SessionSync from "@/components/auth/SessionSync";
import Header from "@/components/Header";
import Sidebar from "@/components/sidebar/Sidebar";
import SidebarSecondary from "@/components/sidebar/SidebarSecondary";
import SidebarSecondaryGate from "@/components/sidebar/SidebarSecondaryGate";
import { getSession } from "@/lib/auth/session";
import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Science_Gothic } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const scienceGothic = Science_Gothic({
  variable: "--font-science-gothic",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Light Rider PQC | Find quantum-vulnerable cryptography",
  description:
    "Veloce gets you ready for harvest-now-decrypt-later attacks. It finds the cryptography in your code that quantum computers will break, then lets you encrypt and sign with NIST-aligned ML-KEM and ML-DSA keys backed by quantum entropy..",
};

// App shell: fixed header, then a row of the primary sidebar, the optional
// secondary sidebar, and the scrolling content area. New top-level UI chrome
// belongs here rather than being duplicated per page.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isAuthenticated } = await getSession();

  return (
    <html
      lang="en"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} ${scienceGothic.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col overflow-hidden">
        <SessionSync initialAuthenticated={isAuthenticated} />
        <Header />
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <SidebarSecondaryGate>
            <SidebarSecondary />
          </SidebarSecondaryGate>
          <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
