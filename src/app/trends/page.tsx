'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Bot, Play, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { useRecords } from '@/lib/hooks/useRecords';
import { MetricCard } from '@/components/ui/MetricCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { TagFrequencyChart } from '@/components/trends/TagFrequencyChart';
import { SiteComparisonMatrix } from '@/components/trends/SiteComparisonMatrix';

interface LlmSettings {
  provider: string;
  model: string;
  apiKey: string;
  status: string;
}

export default function TrendsPage() {
  const { t, lang } = useI18n();
  const { data: records, isLoading } = useRecords();
  const [llm, setLlm] = useState<LlmSettings | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Read LLM settings from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('llm_settings');
      if (raw) setLlm(JSON.parse(raw));
    } catch {}
  }, []);

  const llmConnected = llm?.status === 'connected' && !!llm?.apiKey;

  const handleAnalyze = async () => {
    if (!llm?.apiKey || !records?.length) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      // Build a summary of records for the LLM
      const sample = records.slice(0, 200).map(r => {
        const tags = (r.tags ?? []).slice(0, 5).join(', ');
        return `- ${r.title} [${r.source}] tags: ${tags}`;
      }).join('\n');

      const prompt = `Analyze the following ${records.length} content records and identify the top 10 trends.\nFor each trend provide: name, description, representative tags, example titles.\n\nRecords:\n${sample}\n\nRespond in ${lang === 'zh' ? 'Chinese' : 'English'}.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${llm.model || 'gemini-2.5-flash'}:generateContent?key=${llm.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      setAnalysisResult(text);
    } catch (e: unknown) {
      setAnalysisError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!records || records.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('trend_header')}</h1>
        <EmptyState message={t('no_data_hint')} icon={<TrendingUp size={32} />} />
      </div>
    );
  }

  // KPI computations
  const uniqueTags = new Set<string>();
  const uniqueSources = new Set<string>();
  for (const r of records) {
    if (r.source) uniqueSources.add(r.source);
    for (const tag of r.tags ?? []) {
      const normalized = tag.trim().toLowerCase();
      if (normalized) uniqueTags.add(normalized);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">{t('trend_header')}</h1>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label={t('total_records')}
          value={records.length}
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

      {/* LLM Trend Analysis — now first */}
      <CollapsibleSection title={t('llm_section')} defaultOpen={true}>
        {!llmConnected ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Bot size={32} className="mb-3 text-gray-300" />
            <p className="text-sm mb-1">{t('llm_not_configured')}</p>
            <p className="text-xs text-gray-400">
              {t('llm_configure_hint')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  analyzing
                    ? 'bg-gray-200 text-gray-400'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {analyzing ? t('llm_analyzing') : t('llm_analyze')}
              </button>
              <span className="text-xs text-gray-400">
                {llm.provider} / {llm.model}
              </span>
            </div>

            {analysisError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {analysisError}
              </div>
            )}

            {analysisResult && (
              <div className="p-4 bg-white border border-gray-200 rounded-lg prose prose-sm max-w-none">
                <h3 className="text-base font-semibold text-gray-900 mb-2">{t('llm_trend_title')}</h3>
                <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                  {analysisResult}
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* Tag Frequency */}
      <CollapsibleSection title={t('tag_freq')} defaultOpen={false}>
        <TagFrequencyChart records={records} />
      </CollapsibleSection>

      {/* Site Comparison */}
      <CollapsibleSection title={t('site_compare')} defaultOpen={false}>
        <SiteComparisonMatrix records={records} />
      </CollapsibleSection>
    </div>
  );
}
