import type { Metadata } from "next";
import { Bricolage_Grotesque, Space_Grotesk, Space_Mono } from "next/font/google";
import { ToastProvider } from "@/components/feedback/toast";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getMessages, getTheme } from "@/i18n/server";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const spaceMono = Space_Mono({ variable: "--font-space-mono", subsets: ["latin"], weight: ["400", "700"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["800"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: { default: "Chatquiry", template: "%s · Chatquiry" },
    description: `${t.landing.hero.title1} ${t.landing.hero.title2}`,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, theme, messages] = await Promise.all([getLocale(), getTheme(), getMessages()]);
  return (
    <html lang={locale} data-theme={theme} className={`${spaceGrotesk.variable} ${spaceMono.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale} messages={messages}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
