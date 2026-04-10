'use client';

import { useMemo, useCallback } from 'react';
import { useT } from '@/lib/i18n/context';
import {
  SOURCE_LABELS,
  GAME_SOURCES,
  NOVEL_SOURCES,
  COMIC_SOURCES,
  ARTIST_SOURCES,
} from '@/lib/constants';
import type { ScrapeConfig } from '@/lib/types';

interface SourceTogglesProps {
  config: Partial<ScrapeConfig>;
  onChange: (sourcesEnabled: Record<string, boolean>) => void;
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200
          ${checked ? 'bg-blue-600' : 'bg-gray-300'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm
            transform transition-transform duration-200 mt-0.5
            ${checked ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}
          `}
        />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

interface CategorySectionProps {
  emoji: string;
  title: string;
  sources: string[];
  sourcesEnabled: Record<string, boolean>;
  onToggleSource: (source: string, enabled: boolean) => void;
  onToggleAll: (enabled: boolean) => void;
}

function CategorySection({
  emoji,
  title,
  sources,
  sourcesEnabled,
  onToggleSource,
  onToggleAll,
}: CategorySectionProps) {
  const t = useT();
  const allEnabled = sources.every((s) => sourcesEnabled[s] !== false);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">
          {emoji} {title}
        </h3>
        <ToggleSwitch
          checked={allEnabled}
          onChange={onToggleAll}
          label={t('select_all')}
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {sources.map((src) => (
          <ToggleSwitch
            key={src}
            checked={sourcesEnabled[src] !== false}
            onChange={(enabled) => onToggleSource(src, enabled)}
            label={SOURCE_LABELS[src] ?? src}
          />
        ))}
      </div>
    </div>
  );
}

export function SourceToggles({ config, onChange }: SourceTogglesProps) {
  // Ensure ALL sources have a key (default false) — not just ones user clicked
  const ALL_KEYS = [...GAME_SOURCES, ...NOVEL_SOURCES, ...COMIC_SOURCES, ...ARTIST_SOURCES];
  const sourcesEnabled = useMemo(() => {
    const base: Record<string, boolean> = {};
    for (const k of ALL_KEYS) base[k] = false;
    return { ...base, ...config.sourcesEnabled };
  }, [config.sourcesEnabled]);

  const handleToggleSource = useCallback(
    (source: string, enabled: boolean) => {
      onChange({ ...sourcesEnabled, [source]: enabled });
    },
    [sourcesEnabled, onChange]
  );

  const handleToggleAll = useCallback(
    (sources: string[], enabled: boolean) => {
      const updated = { ...sourcesEnabled };
      for (const src of sources) {
        updated[src] = enabled;
      }
      onChange(updated);
    },
    [sourcesEnabled, onChange]
  );

  const categories: { emoji: string; title: string; sources: string[] }[] = [
    { emoji: '🎮', title: 'Game', sources: GAME_SOURCES },
    { emoji: '📖', title: 'Novel', sources: NOVEL_SOURCES },
    { emoji: '📚', title: 'Comic', sources: COMIC_SOURCES },
    { emoji: '🎨', title: 'Artist', sources: ARTIST_SOURCES },
  ];

  return (
    <div className="space-y-5">
      {categories.map((cat) => (
        <CategorySection
          key={cat.title}
          emoji={cat.emoji}
          title={cat.title}
          sources={cat.sources}
          sourcesEnabled={sourcesEnabled}
          onToggleSource={handleToggleSource}
          onToggleAll={(enabled) => handleToggleAll(cat.sources, enabled)}
        />
      ))}
    </div>
  );
}
