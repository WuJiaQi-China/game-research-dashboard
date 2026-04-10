import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n/context';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { NavTabs } from '@/components/layout/NavTabs';

export const metadata: Metadata = {
  title: 'Game Research Dashboard',
  description: 'Content research dashboard for games, novels, comics and artists',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="bg-gray-50 min-h-screen">
        <QueryProvider>
          <I18nProvider>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <main className="flex-1 flex flex-col overflow-hidden">
                <NavTabs />
                <div className="flex-1 overflow-y-auto p-6">
                  {children}
                </div>
              </main>
            </div>
          </I18nProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
