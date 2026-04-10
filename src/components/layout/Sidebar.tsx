'use client';

import { useState } from 'react';
import {
  Search,
  Gamepad2,
  BookOpen,
  BookImage,
  Palette,
  ChevronLeft,
  ChevronRight,
  Languages,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { TYPE_LABELS, GAME_SOURCES, NOVEL_SOURCES, COMIC_SOURCES, ARTIST_SOURCES, SOURCE_LABELS } from '@/lib/constants';
import type { ContentType } from '@/lib/types';

const typeFilters: { key: ContentType; icon: typeof Gamepad2 }[] = [
  { key: 'game', icon: Gamepad2 },
  { key: 'novel', icon: BookOpen },
  { key: 'comic', icon: BookImage },
  { key: 'artist', icon: Palette },
];

const sourcesByType: Record<ContentType, string[]> = {
  game: GAME_SOURCES,
  novel: NOVEL_SOURCES,
  comic: COMIC_SOURCES,
  artist: ARTIST_SOURCES,
};

export function Sidebar() {
  const { lang, setLang, t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTypes, setActiveTypes] = useState<Set<ContentType>>(new Set());
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());

  const toggleType = (key: ContentType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSource = (key: string) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleLang = () => setLang(lang === 'zh' ? 'en' : 'zh');

  // Sources visible based on active types (all if none selected)
  const visibleSources = (() => {
    const types = activeTypes.size > 0 ? [...activeTypes] : typeFilters.map((f) => f.key);
    const set = new Set<string>();
    types.forEach((type) => sourcesByType[type]?.forEach((s) => set.add(s)));
    return [...set];
  })();

  if (collapsed) {
    return (
      <aside className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-2 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ChevronRight size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <h1 className="text-base font-semibold text-gray-800 truncate">
          Game Research
        </h1>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleLang}
            className="px-2 py-1 text-xs font-medium rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            <Languages size={14} className="inline mr-1" />
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Scrollable filter area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Type Filter */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {t('content_type')}
          </h3>
          <div className="space-y-1">
            {typeFilters.map(({ key, icon: Icon }) => {
              const active = activeTypes.has(key);
              const label = TYPE_LABELS[key]?.[lang] ?? key;
              return (
                <label
                  key={key}
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleType(key)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Icon size={15} />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Source Filter */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {t('data_source')}
          </h3>
          <div className="space-y-1">
            {visibleSources.map((source) => {
              const active = activeSources.has(source);
              return (
                <label
                  key={source}
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleSource(source)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{SOURCE_LABELS[source] ?? source}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
