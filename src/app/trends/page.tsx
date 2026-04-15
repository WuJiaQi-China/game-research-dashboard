'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  TrendingUp, Bot, Play, Loader2, RefreshCw, Clock, X,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { useRecords } from '@/lib/hooks/useRecords';
import { useAnalysis } from '@/components/providers/AnalysisProvider';
import { MetricCard } from '@/components/ui/MetricCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Badge } from '@/components/ui/Badge';
import type { TrendItem, AdCreative, HookType, ContentRecord } from '@/lib/types';

// Code-split heavy chart components — they only render inside CollapsibleSection
// (default-collapsed), so keeping them out of the initial chunk shrinks it.
const TagFrequencyChart = dynamic(
  () => import('@/components/trends/TagFrequencyChart').then(m => ({ default: m.TagFrequencyChart })),
  { ssr: false },
);
const SiteComparisonMatrix = dynamic(
  () => import('@/components/trends/SiteComparisonMatrix').then(m => ({ default: m.SiteComparisonMatrix })),
  { ssr: false },
);

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

interface LlmSettings {
  provider: string;
  model: string;
  apiKey: string;
  status: string;
}

/** Build a lookup map: lowercase title → link URL */
function buildTitleLinkMap(records: ContentRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of records) {
    if (r.link && r.title) {
      map.set(r.title.toLowerCase(), r.link);
    }
  }
  return map;
}

/* ------------------------------------------------------------------ */
/*  Hook mockup renderer                                              */
/* ------------------------------------------------------------------ */

const HOOK_TYPE_LABEL_KEYS: Record<HookType, string> = {
  text_overlay: 'hook_type_text_overlay',
  choice: 'hook_type_choice',
  button: 'hook_type_button',
  swipe: 'hook_type_swipe',
  slider: 'hook_type_slider',
};

const HOOK_TYPE_COLORS: Record<HookType, { bg: string; fg: string }> = {
  text_overlay: { bg: '#EDE9FE', fg: '#7C3AED' },
  choice: { bg: '#FEF3C7', fg: '#D97706' },
  button: { bg: '#FEE2E2', fg: '#DC2626' },
  swipe: { bg: '#D1FAE5', fg: '#059669' },
  slider: { bg: '#DBEAFE', fg: '#2563EB' },
};

function HookMockup({ type, content, lang }: { type: HookType; content: string; lang: string }) {
  if (!content) return null;

  if (type === 'text_overlay') {
    return (
      <div className="bg-gray-900 text-white px-5 py-4 rounded-xl text-center italic">
        &ldquo;{content}&rdquo;
      </div>
    );
  }

  if (type === 'choice') {
    const options = content.split('|').map(o => o.trim()).filter(Boolean);
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-gray-400">{lang === 'zh' ? '选择一个选项' : 'Choose an option'}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {options.map((o, i) => (
            <span key={i} className="px-4 py-2 rounded-full border-2 border-amber-500 bg-amber-50 text-amber-700 font-semibold text-sm">
              {o}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'button') {
    return (
      <div className="text-center">
        <span className="inline-block px-8 py-3 rounded-full bg-gradient-to-br from-red-400 to-orange-500 text-white font-bold text-base shadow-lg shadow-orange-300/40">
          {content}
        </span>
      </div>
    );
  }

  if (type === 'swipe') {
    const parts = content.split('/');
    const left = (parts[0] ?? '').replace(/LEFT:/i, '').trim();
    const right = (parts[1] ?? '').replace(/RIGHT:/i, '').trim();
    return (
      <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
        <span className="px-3 py-2 rounded-2xl bg-red-100 text-red-700 font-semibold text-sm">
          {left}
        </span>
        <span className="text-xs text-gray-400">
          &larr; {lang === 'zh' ? '滑动' : 'swipe'} &rarr;
        </span>
        <span className="px-3 py-2 rounded-2xl bg-green-100 text-green-700 font-semibold text-sm">
          {right}
        </span>
      </div>
    );
  }

  // slider
  const colonIdx = content.indexOf(':');
  const label = colonIdx >= 0 ? content.slice(0, colonIdx).trim() : '';
  const rangeStr = colonIdx >= 0 ? content.slice(colonIdx + 1).trim() : content;
  const ends = rangeStr.split(/←\s*→|←→/).map(s => s.trim());
  const minL = ends[0] ?? '';
  const maxL = ends[1] ?? '';

  return (
    <div className="p-3 bg-gray-50 rounded-xl space-y-2">
      {label && <p className="text-center font-semibold text-sm">{label}</p>}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 min-w-[50px] text-right">{minL}</span>
        <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-blue-300 to-orange-400 relative">
          <div className="absolute -top-1.5 left-[60%] w-5 h-5 bg-white rounded-full border-[3px] border-orange-400 shadow" />
        </div>
        <span className="text-xs text-gray-500 min-w-[50px]">{maxL}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ad Creative Modal                                                 */
/* ------------------------------------------------------------------ */

function AdCreativeModal({
  creatives,
  trendName,
  t,
  lang,
  onClose,
}: {
  creatives: AdCreative[];
  trendName: string;
  t: (k: any) => string;
  lang: string;
  onClose: () => void;
}) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            {t('view_ad_creatives')} — {trendName}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {creatives.slice(0, 3).map((c, i) => {
            const colors = HOOK_TYPE_COLORS[c.hookType] ?? HOOK_TYPE_COLORS.text_overlay;
            return (
              <div key={i} className="border border-gray-100 rounded-xl p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">
                    {t('ad_creative_n').replace('{}', String(i + 1))}
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: colors.bg, color: colors.fg }}
                  >
                    {t(HOOK_TYPE_LABEL_KEYS[c.hookType] as any)}
                  </span>
                </div>
                {/* Visual description */}
                {c.visualDescription && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                    <p className="text-xs font-semibold text-blue-600 mb-1">{t('visual_description')}</p>
                    {c.visualDescription}
                  </div>
                )}
                {/* Hook mockup */}
                {c.hookContent && (
                  <HookMockup type={c.hookType} content={c.hookContent} lang={lang} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Trend Card                                                        */
/* ------------------------------------------------------------------ */

function TrendCard({
  item,
  t,
  lang,
  titleLinkMap,
  onApplyFilter,
  onOpenCreatives,
}: {
  item: TrendItem;
  t: (k: any) => string;
  lang: string;
  titleLinkMap: Map<string, string>;
  onApplyFilter: (tags: string[], name: string) => void;
  onOpenCreatives: (item: TrendItem) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header: rank + name + score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 font-bold text-sm shrink-0">
            {item.rank}
          </span>
          <h3 className="font-semibold text-gray-900 leading-tight">{item.name}</h3>
        </div>
        <div className="flex items-center gap-1.5 text-sm shrink-0">
          <span className="text-gray-400">{t('llm_trend_score')}</span>
          <span className="font-bold text-blue-600">{item.score}</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>

      {/* Tags */}
      {item.representativeTags.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">{t('llm_trend_tags')}</p>
          <div className="flex flex-wrap gap-1.5">
            {item.representativeTags.map(tag => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Example titles — as clickable links when possible */}
      {item.exampleTitles.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1">{t('llm_trend_examples')}</p>
          <ul className="text-sm space-y-0.5">
            {item.exampleTitles.map((title, i) => {
              const link = titleLinkMap.get(title.toLowerCase());
              return (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-gray-300 shrink-0">-</span>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {title}
                    </a>
                  ) : (
                    <span className="text-gray-700">{title}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        {/* Apply filter → navigates to browse */}
        <button
          type="button"
          onClick={() => onApplyFilter(item.representativeTags, item.name)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
        >
          {t('apply_trend_filter')} &rarr;
        </button>

        {/* Ad creatives → opens modal */}
        {item.adCreatives && item.adCreatives.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenCreatives(item)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors cursor-pointer"
          >
            {t('view_ad_creatives')}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export default function TrendsPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { data: records, isLoading } = useRecords();
  const { analyzing, analysis, rawFallback, error: analysisError, startAnalysis } = useAnalysis();

  const [llm, setLlm] = useState<LlmSettings | null>(null);
  const [creativeModal, setCreativeModal] = useState<TrendItem | null>(null);

  // Read LLM settings from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('llm_settings');
      if (raw) setLlm(JSON.parse(raw));
    } catch {}
  }, []);

  const llmConnected = llm?.status === 'connected' && !!llm?.apiKey;

  const handleApplyFilter = useCallback((tags: string[], name: string) => {
    localStorage.setItem('trend_filter', JSON.stringify({ tags, name }));
    router.push('/browse');
  }, [router]);

  const handleOpenCreatives = useCallback((item: TrendItem) => {
    setCreativeModal(item);
  }, []);

  const safeRecords = records ?? [];

  const handleAnalyze = () => {
    if (!llm?.apiKey || !safeRecords.length) return;
    startAnalysis(llm.apiKey, llm.model, safeRecords, lang);
  };

  // Only short-circuit to empty-state once the query has resolved with zero rows.
  // While loading, render the full page shell so the tab click feels instant.
  if (!isLoading && safeRecords.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('trend_header')}</h1>
        <EmptyState message={t('no_data_hint')} icon={<TrendingUp size={32} />} />
      </div>
    );
  }

  // Build title→link lookup
  const titleLinkMap = buildTitleLinkMap(safeRecords);

  // KPI computations
  const uniqueTags = new Set<string>();
  const uniqueSources = new Set<string>();
  for (const r of safeRecords) {
    if (r.source) uniqueSources.add(r.source);
    for (const tag of r.tags ?? []) {
      const normalized = tag.trim().toLowerCase();
      if (normalized) uniqueTags.add(normalized);
    }
  }

  const hasCachedResults = !!analysis;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">{t('trend_header')}</h1>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label={t('total_records')}
          value={safeRecords.length}
          icon={<TrendingUp size={20} />}
        />
        <MetricCard
          label={t('col_tags')}
          value={uniqueTags.size}
        />
        <MetricCard
          label={t('sites_covered')}
          value={uniqueSources.size}
        />
      </div>

      {/* LLM Trend Analysis */}
      <CollapsibleSection title={t('llm_section')} defaultOpen={false}>
        <div className="space-y-4">
          {/* Action bar — always show if LLM connected */}
          {llmConnected && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    analyzing
                      ? 'bg-gray-200 text-gray-400'
                      : hasCachedResults
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {analyzing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : hasCachedResults ? (
                    <RefreshCw size={16} />
                  ) : (
                    <Play size={16} />
                  )}
                  {analyzing
                    ? t('llm_analyzing')
                    : hasCachedResults
                      ? t('llm_reanalyze')
                      : t('llm_analyze')}
                </button>
                <span className="text-xs text-gray-400">
                  {llm.provider} / {llm.model}
                </span>
              </div>

              {/* Timestamp */}
              {analysis?.createdAt && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock size={12} />
                  <span>{new Date(analysis.createdAt).toLocaleString()}</span>
                  <span className="text-gray-300">|</span>
                  <span>{t('llm_trend_matched').replace('{}', String(analysis.recordCount))}</span>
                </div>
              )}
            </div>
          )}

          {/* Not connected hint — only when no cached results AND no LLM */}
          {!llmConnected && !hasCachedResults && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Bot size={32} className="mb-3 text-gray-300" />
              <p className="text-sm mb-1">{t('llm_not_configured')}</p>
              <p className="text-xs text-gray-400">{t('llm_configure_hint')}</p>
            </div>
          )}

          {/* Error */}
          {analysisError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {analysisError}
            </div>
          )}

          {/* Cached timestamp when LLM not connected but results exist */}
          {!llmConnected && hasCachedResults && analysis?.createdAt && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Clock size={12} />
              <span>{new Date(analysis.createdAt).toLocaleString()}</span>
              <span className="text-gray-300">|</span>
              <span>{t('llm_trend_matched').replace('{}', String(analysis.recordCount))}</span>
            </div>
          )}

          {/* Structured result — always show if available */}
          {analysis && (
            <div className="space-y-4">
              {/* Summary */}
              {analysis.summary && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <h3 className="text-sm font-semibold text-blue-900 mb-1">
                    {t('llm_trend_summary')}
                  </h3>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    {analysis.summary}
                  </p>
                </div>
              )}

              {/* Title */}
              <h3 className="text-base font-semibold text-gray-900">
                {t('llm_trend_title')}
              </h3>

              {/* Card grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {analysis.trends.map(item => (
                  <TrendCard
                    key={item.rank}
                    item={item}
                    t={t}
                    lang={lang}
                    titleLinkMap={titleLinkMap}
                    onApplyFilter={handleApplyFilter}
                    onOpenCreatives={handleOpenCreatives}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Raw fallback */}
          {rawFallback && !analysis && (
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                {t('llm_trend_title')}
              </h3>
              <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                {rawFallback}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Tag Frequency */}
      <CollapsibleSection title={t('tag_freq')} defaultOpen={false}>
        <TagFrequencyChart records={safeRecords} />
      </CollapsibleSection>

      {/* Site Comparison */}
      <CollapsibleSection title={t('site_compare')} defaultOpen={false}>
        <SiteComparisonMatrix records={safeRecords} />
      </CollapsibleSection>

      {/* Ad Creative Modal */}
      {creativeModal && creativeModal.adCreatives && (
        <AdCreativeModal
          creatives={creativeModal.adCreatives}
          trendName={creativeModal.name}
          t={t}
          lang={lang}
          onClose={() => setCreativeModal(null)}
        />
      )}
    </div>
  );
}
