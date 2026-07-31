import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "E-KampusMo — Student life, in one place",
    template: "%s | E-KampusMo",
  },
  description:
    "Connect Classroom, organize your class schedule, track internship hours, and understand student expenses in one calm workspace.",
  applicationName: "E-KampusMo",
  keywords: [
    "student planner",
    "class schedule",
    "internship tracker",
    "academic organizer",
  ],
  openGraph: {
    type: "website",
    siteName: "E-KampusMo",
    title: "E-KampusMo — Student life, in one place",
    description:
      "Connect Classroom, organize your schedule, track internship hours, and understand student expenses.",
    images: [
      {
        url: "/og-v3.png",
        width: 1728,
        height: 912,
        alt: "E-KampusMo student companion dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "E-KampusMo — Student life, in one place",
    description:
      "Plan classes, deadlines, internship hours, and student expenses in one private companion.",
    images: ["/og-v3.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${manrope.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
