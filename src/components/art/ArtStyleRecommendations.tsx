'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Play, Loader2, RefreshCw, Clock, ExternalLink, Palette, Gamepad2, Globe,
} from 'lucide-react';
import { useI18n, useT } from '@/lib/i18n/context';
import { Badge } from '@/components/ui/Badge';
import type {
  ArtStyleRecommendation,
  ArtStyleAnalysis,
  ArtStyleTimeRange,
  ArtStyleReference,
} from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  JSON parser                                                       */
/* ------------------------------------------------------------------ */

function parseStyleResponse(
  text: string,
  timeRange: ArtStyleTimeRange,
): ArtStyleAnalysis | null {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  try {
    const obj = JSON.parse(cleaned);
    if (!Array.isArray(obj.styles) || obj.styles.length === 0) return null;

    const styles: ArtStyleRecommendation[] = obj.styles.map((s: any, i: number) => {
      const refs: ArtStyleReference[] = Array.isArray(s.references)
        ? s.references
            .map((r: any) => ({
              title: String(r.title ?? r.name ?? ''),
              url: String(r.url ?? ''),
              kind: (r.kind === 'game' ? 'game' : 'webpage') as 'game' | 'webpage',
            }))
            .filter((r: ArtStyleReference) => r.url.startsWith('http'))
        : [];

      return {
        rank: typeof s.rank === 'number' ? s.rank : i + 1,
        name: String(s.name || ''),
        nameEn: String(s.name_en ?? s.nameEn ?? ''),
        description: String(s.description || ''),
        keywords: Array.isArray(s.keywords) ? s.keywords.map(String) : [],
        references: refs,
        imageUrls: Array.isArray(s.image_urls ?? s.imageUrls)
          ? (s.image_urls ?? s.imageUrls).map(String).filter((u: string) => u.startsWith('http'))
          : [],
        score: typeof s.score === 'number' ? Math.min(100, Math.max(0, s.score)) : 50,
      };
    });

    return {
      styles,
      summary: String(obj.summary || ''),
      timeRange,
      queriedAt: String(obj.queried_at ?? obj.queriedAt ?? new Date().toISOString()),
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Safe image with error fallback                                    */
/* ------------------------------------------------------------------ */

function SafeImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      <img
        src={src}
        alt={alt}
        className="h-40 w-auto rounded-lg object-cover border border-gray-200 hover:shadow-md hover:border-purple-300 transition-all cursor-pointer"
        onError={() => setFailed(true)}
        referrerPolicy="no-referrer"
        loading="lazy"
      />
    </a>
  );
}

/* ------------------------------------------------------------------ */
/*  Style card                                                        */
/* ------------------------------------------------------------------ */

function StyleCard({
  style,
  t,
  lang,
}: {
  style: ArtStyleRecommendation;
  t: (k: any) => string;
  lang: string;
}) {
  const displayName = lang === 'zh' ? style.name : (style.nameEn || style.name);
  const games = style.references.filter(r => r.kind === 'game');
  const pages = style.references.filter(r => r.kind === 'webpage');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-50 text-purple-600 font-bold text-sm shrink-0">
            {style.rank}
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 leading-tight truncate">{displayName}</h3>
            {style.nameEn && lang === 'zh' && (
              <p className="text-xs text-gray-400 truncate">{style.nameEn}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-sm shrink-0">
          <span className="text-gray-400">{t('art_style_score')}</span>
          <span className="font-bold text-purple-600">{style.score}</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed">{style.description}</p>

      {/* Keywords */}
      {style.keywords.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">{t('art_style_keywords')}</p>
          <div className="flex flex-wrap gap-1.5">
            {style.keywords.map(kw => (
              <Badge key={kw} color="#7C3AED">{kw}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Sample images */}
      {style.imageUrls.length > 0 && (
        <div className="flex gap-3 overflow-x-auto py-1">
          {style.imageUrls.map((url, i) => (
            <SafeImage key={i} src={url} alt={`${displayName} sample ${i + 1}`} />
          ))}
        </div>
      )}

      {/* References: games + webpages */}
      {(games.length > 0 || pages.length > 0) && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">{t('art_style_refs')}</p>
          <div className="flex flex-wrap gap-2">
            {games.map((r, i) => (
              <a
                key={`g-${i}`}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Gamepad2 size={12} />
                {r.title}
              </a>
            ))}
            {pages.map((r, i) => (
              <a
                key={`p-${i}`}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Globe size={12} />
                {r.title}
                <ExternalLink size={10} />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'art_style_analysis';

interface LlmSettings {
  provider: string;
  model: string;
  apiKey: string;
  status: string;
}

function rangeToHumanZh(range: ArtStyleTimeRange): string {
  return { '1w': '最近一周', '1m': '最近一月', '3m': '最近三个月' }[range];
}
function rangeToHumanEn(range: ArtStyleTimeRange): string {
  return { '1w': 'the past week', '1m': 'the past month', '3m': 'the past three months' }[range];
}

export function ArtStyleRecommendations() {
  const t = useT();
  const { lang } = useI18n();

  const [llm, setLlm] = useState<LlmSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ArtStyleAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<ArtStyleTimeRange>('1m');

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('llm_settings');
      if (raw) setLlm(JSON.parse(raw));
    } catch {}
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed: ArtStyleAnalysis = JSON.parse(cached);
        if (parsed.styles?.length) {
          setAnalysis(parsed);
          if (parsed.timeRange) setTimeRange(parsed.timeRange);
        }
      }
    } catch {}
  }, []);

  const llmConnected = llm?.status === 'connected' && !!llm?.apiKey;
  const hasCachedResults = !!analysis;

  const generate = useCallback(() => {
    if (!llm?.apiKey) return;
    setLoading(true);
    setError(null);

    const nowIso = new Date().toISOString();
    const nowLabel = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');
    const langLabel = lang === 'zh' ? 'Chinese' : 'English';
    const rangeHuman = lang === 'zh' ? rangeToHumanZh(timeRange) : rangeToHumanEn(timeRange);

    const prompt = `You are a game art market analyst. Use Google Search to find the latest trends.

**Current timestamp:** ${nowIso} (today is ${nowLabel})
**Time range to analyze:** ${rangeHuman} (relative to today)

**Target genre:** Female-oriented dialogue/chat-based games (otome games, visual novels with choice-based dialogue, chat-story games like MeChat, Episode, Chapters, Love and Deepspace, Mystic Messenger, etc.)

**Task:** Search online for the 10 MOST POPULAR art styles in this genre within the specified time range. Look at release dates, trending lists, review dates, and discussion timestamps to ensure all findings are from the past ${timeRange === '1w' ? '7 days' : timeRange === '1m' ? '30 days' : '90 days'}.

**Sources to search (combine both):**
- **Player-facing**: Reddit (r/otomegames, r/visualnovels, r/mobilegaming, r/RomanceBooks), App Store / Google Play top charts and reviews, TikTok / YouTube ad engagement, Steam reviews & wishlist changes, official game subreddits and Discord servers
- **Creator-facing**: ArtStation trending, Pixiv popular tags, CivitAI trending models

**Return JSON wrapped in \`\`\`json fences:**
{
  "queried_at": "${nowIso}",
  "styles": [
    {
      "rank": 1,
      "name": "Style name in ${langLabel}",
      "name_en": "English Name",
      "description": "Why this style is trending NOW (past ${rangeHuman}). Cite specific games, player discussions, or engagement data you found. 3-4 sentences.",
      "keywords": ["semi-realism", "soft-shading", "..."],
      "references": [
        { "title": "Love and Deepspace", "url": "https://...", "kind": "game" },
        { "title": "Reddit discussion on r/otomegames", "url": "https://reddit.com/...", "kind": "webpage" }
      ],
      "image_urls": ["https://... direct image URLs ..."],
      "score": 92
    }
    /* ... 9 more styles, 10 total ... */
  ],
  "summary": "Overall trend overview for ${rangeHuman} in ${langLabel}"
}

**Requirements:**
- Return EXACTLY 10 styles, ranked 1-10 by popularity
- Every "references" array MUST contain at least 2 entries: at least 1 game (kind:"game") AND at least 1 webpage (kind:"webpage")
- "references" should ONLY be real, verified URLs you found via search
- "image_urls" should be direct embeddable image links (.jpg/.png/.webp) when available; empty array if none reliable
- Do NOT use memorized knowledge — everything must come from your search results dated within ${rangeHuman}
- Respond entirely in ${langLabel}`;

    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${llm.model || 'gemini-2.5-flash'}:generateContent?key=${llm.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
        }),
      },
    )
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = parseStyleResponse(text, timeRange);
        if (parsed) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          setAnalysis(parsed);
        } else {
          setError(lang === 'zh' ? '解析响应失败，请重试。' : 'Failed to parse response. Please retry.');
        }
      })
      .catch(e => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [llm, lang, timeRange]);

  const ranges: ArtStyleTimeRange[] = ['1w', '1m', '3m'];
  const rangeLabelKey: Record<ArtStyleTimeRange, string> = {
    '1w': 'art_style_range_1w',
    '1m': 'art_style_range_1m',
    '3m': 'art_style_range_3m',
  };

  return (
    <div className="space-y-4">
      {/* Description */}
      <p className="text-sm text-gray-600">{t('art_style_desc')}</p>

      {/* Time range selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-600 font-medium">{t('art_style_time_range')}:</span>
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {ranges.map((r, i) => (
            <button
              key={r}
              type="button"
              onClick={() => setTimeRange(r)}
              disabled={loading}
              className={`px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                timeRange === r
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              } ${i > 0 ? 'border-l border-gray-200' : ''} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {t(rangeLabelKey[r] as any)}
            </button>
          ))}
        </div>
      </div>

      {/* Action bar */}
      {llmConnected && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                loading
                  ? 'bg-gray-200 text-gray-400'
                  : hasCachedResults
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : hasCachedResults ? (
                <RefreshCw size={16} />
              ) : (
                <Play size={16} />
              )}
              {loading
                ? t('art_style_generating')
                : hasCachedResults
                  ? t('art_style_regenerate')
                  : t('art_style_generate')}
            </button>
            <span className="text-xs text-gray-400">
              {llm.provider} / {llm.model}
            </span>
          </div>

          {analysis?.queriedAt && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Clock size={12} />
              <span>{t('art_style_queried_at')}: {new Date(analysis.queriedAt).toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Not connected hint */}
      {!llmConnected && !hasCachedResults && (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <Palette size={32} className="mb-3 text-gray-300" />
          <p className="text-sm mb-1">{t('llm_not_configured')}</p>
          <p className="text-xs text-gray-400">{t('llm_configure_hint')}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Cached timestamp when LLM not connected */}
      {!llmConnected && hasCachedResults && analysis?.queriedAt && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock size={12} />
          <span>{t('art_style_queried_at')}: {new Date(analysis.queriedAt).toLocaleString()}</span>
        </div>
      )}

      {/* Results */}
      {analysis && (
        <div className="space-y-4">
          {/* Summary */}
          {analysis.summary && (
            <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
              <h3 className="text-sm font-semibold text-purple-900 mb-1">
                {t('art_style_summary')}
              </h3>
              <p className="text-sm text-purple-800 leading-relaxed">
                {analysis.summary}
              </p>
            </div>
          )}

          {/* Style cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {analysis.styles.map(style => (
              <StyleCard key={style.rank} style={style} t={t} lang={lang} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
