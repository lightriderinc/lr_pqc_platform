import Header from "@/components/Header";
import Sidebar from "@/components/sidebar/Sidebar";
import SidebarSecondary from "@/components/sidebar/SidebarSecondary";
import SidebarSecondaryGate from "@/components/sidebar/SidebarSecondaryGate";
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
  title: "Light Rider PQC",
  description: "Light Rider post-quantum cryptography platform.",
};

// App shell: fixed header, then a row of the primary sidebar, the optional
// secondary sidebar, and the scrolling content area. New top-level UI chrome
// belongs here rather than being duplicated per page.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} ${scienceGothic.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col overflow-hidden">
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
