'use client';

import { useState, useCallback } from 'react';
import { useT } from '@/lib/i18n/context';
import type { ScrapeConfig, CategoryConfig, ArtistCategoryConfig } from '@/lib/types';

interface KeywordConfigProps {
  config: Partial<ScrapeConfig>;
  onChange: (config: Partial<ScrapeConfig>) => void;
}

type CategoryKey = 'game' | 'novel' | 'comic' | 'artist';

const TABS: { key: CategoryKey; emoji: string; label: string }[] = [
  { key: 'game', emoji: '', label: 'Game' },
  { key: 'novel', emoji: '', label: 'Novel' },
  { key: 'comic', emoji: '', label: 'Comic' },
  { key: 'artist', emoji: '', label: 'Artist' },
];

const DEFAULT_CATEGORY: CategoryConfig = {
  searchKeywords: [],
  maxPerKeyword: 20,
  maxPerPlatform: 50,
  blockKeywords: [],
};

const RANKING_MODES = [
  'day', 'week', 'month', 'day_male', 'day_female',
  'week_original', 'week_rookie', 'day_r18',
];

export function KeywordConfig({ config, onChange }: KeywordConfigProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<CategoryKey>('game');

  const getCategoryConfig = useCallback(
    (key: CategoryKey): CategoryConfig | ArtistCategoryConfig => {
      const base = config[key] ?? { ...DEFAULT_CATEGORY };
      if (key === 'artist') {
        return {
          ...DEFAULT_CATEGORY,
          rankingMode: 'day',
          nsfwFilter: true,
          ...base,
        } as ArtistCategoryConfig;
      }
      return { ...DEFAULT_CATEGORY, ...base };
    },
    [config]
  );

  const updateCategory = useCallback(
    (key: CategoryKey, updates: Partial<CategoryConfig | ArtistCategoryConfig>) => {
      const current = getCategoryConfig(key);
      onChange({ [key]: { ...current, ...updates } });
    },
    [getCategoryConfig, onChange]
  );

  const catConfig = getCategoryConfig(activeTab);
  const isArtist = activeTab === 'artist';
  const artistConfig = isArtist ? (catConfig as ArtistCategoryConfig) : null;

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* Config fields */}
      <div className="space-y-4">
        {/* Keywords textarea */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('kw_label')}
          </label>
          <p className="text-xs text-gray-400 mb-1">{t('kw_help')}</p>
          <textarea
            value={(catConfig.searchKeywords ?? []).join('\n')}
            onChange={(e) => {
              const keywords = e.target.value
                .split('\n')
                .map((k) => k.trim())
                .filter(Boolean);
              updateCategory(activeTab, { searchKeywords: keywords });
            }}
            rows={5}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            placeholder="otome game&#10;visual novel&#10;romance RPG"
          />
        </div>

        {/* Max per keyword */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('max_per_kw')}
            </label>
            <p className="text-xs text-gray-400 mb-1">{t('max_per_kw_help')}</p>
            <input
              type="number"
              min={1}
              max={200}
              value={catConfig.maxPerKeyword}
              onChange={(e) =>
                updateCategory(activeTab, {
                  maxPerKeyword: parseInt(e.target.value, 10) || 1,
                })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Max per platform */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('max_per_platform')}
            </label>
            <p className="text-xs text-gray-400 mb-1">{t('max_per_platform_help')}</p>
            <input
              type="number"
              min={1}
              max={500}
              value={catConfig.maxPerPlatform}
              onChange={(e) =>
                updateCategory(activeTab, {
                  maxPerPlatform: parseInt(e.target.value, 10) || 1,
                })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Block keywords */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('block_kw')}
          </label>
          <p className="text-xs text-gray-400 mb-1">{t('block_kw_help')}</p>
          <textarea
            value={(catConfig.blockKeywords ?? []).join('\n')}
            onChange={(e) => {
              const keywords = e.target.value
                .split('\n')
                .map((k) => k.trim())
                .filter(Boolean);
              updateCategory(activeTab, { blockKeywords: keywords });
            }}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            placeholder="DLC&#10;Expansion&#10;Soundtrack"
          />
        </div>

        {/* Artist-specific fields */}
        {isArtist && artistConfig && (
          <div className="space-y-4 pt-2 border-t border-gray-100">
            {/* Ranking mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('pixiv_ranking_mode')}
              </label>
              <p className="text-xs text-gray-400 mb-1">{t('pixiv_ranking_help')}</p>
              <select
                value={artistConfig.rankingMode}
                onChange={(e) =>
                  updateCategory('artist', { rankingMode: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {RANKING_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>

            {/* NSFW filter toggle */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={artistConfig.nsfwFilter}
                  onClick={() =>
                    updateCategory('artist', {
                      nsfwFilter: !artistConfig.nsfwFilter,
                    })
                  }
                  className={`
                    relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200
                    ${artistConfig.nsfwFilter ? 'bg-blue-600' : 'bg-gray-300'}
                  `}
                >
                  <span
                    className={`
                      pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm
                      transform transition-transform duration-200 mt-0.5
                      ${artistConfig.nsfwFilter ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}
                    `}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  {t('nsfw_filter_label')}
                </span>
              </label>
              <p className="text-xs text-gray-400 mt-1 ml-11">
                {t('nsfw_filter_help')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
