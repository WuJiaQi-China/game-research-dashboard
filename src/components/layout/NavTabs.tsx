'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, TrendingUp, Palette, Settings } from 'lucide-react';
import { useT } from '@/lib/i18n/context';

const tabs = [
  { href: '/browse', labelKey: 'tab_browse' as const, icon: LayoutGrid },
  { href: '/trends', labelKey: 'tab_trends' as const, icon: TrendingUp },
  { href: '/art', labelKey: 'tab_art' as const, icon: Palette },
  { href: '/settings', labelKey: 'tab_deep' as const, icon: Settings },
] as const;

export function NavTabs() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 shrink-0">
      <div className="flex gap-1">
        {tabs.map(({ href, labelKey, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={16} />
              {t(labelKey as any)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
