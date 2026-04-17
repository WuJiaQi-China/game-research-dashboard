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
  GroundingSource,
} from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  JSON parser                                                       */
/* ------------------------------------------------------------------ */

function parseStyleResponse(
  text: string,
  timeRange: ArtStyleTimeRange,
  groundingSources: GroundingSource[],
): ArtStyleAnalysis | null {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  try {
    const obj = JSON.parse(cleaned);
    if (!Array.isArray(obj.styles) || obj.styles.length === 0) return null;

    const styles: ArtStyleRecommendation[] = obj.styles.map((s: any, i: number) => {
      // References: games only (names, we'll auto-generate Google search links)
      const games: ArtStyleReference[] = Array.isArray(s.reference_games ?? s.referenceGames)
        ? (s.reference_games ?? s.referenceGames)
            .map((g: any) => {
              const title = typeof g === 'string' ? g : String(g?.title ?? g?.name ?? '');
              if (!title) return null;
              return {
                title,
                url: `https://www.google.com/search?q=${encodeURIComponent(title + ' game')}`,
                kind: 'game' as const,
              };
            })
            .filter((r: ArtStyleReference | null): r is ArtStyleReference => !!r)
        : [];

      return {
        rank: typeof s.rank === 'number' ? s.rank : i + 1,
        name: String(s.name || ''),
        nameEn: String(s.name_en ?? s.nameEn ?? s.name ?? ''),
        description: String(s.description || ''),
        keywords: Array.isArray(s.keywords) ? s.keywords.map(String) : [],
        references: games,
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
      groundingSources,
    };
  } catch {
    return null;
  }
}

/** Extract real URLs from Gemini grounding metadata — these are never hallucinated. */
function extractGroundingSources(apiResponse: any): GroundingSource[] {
  const chunks = apiResponse?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const out: GroundingSource[] = [];
  for (const c of chunks) {
    const uri = c?.web?.uri;
    const title = c?.web?.title;
    if (typeof uri !== 'string' || !uri.startsWith('http')) continue;
    if (seen.has(uri)) continue;
    seen.add(uri);
    out.push({ title: String(title || uri), uri });
  }
  return out;
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
  const displayName = style.nameEn || style.name;
  const refs = style.references ?? [];
  const imageUrls = style.imageUrls ?? [];
  const keywords = style.keywords ?? [];
  const games = refs.filter(r => r.kind === 'game');

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
      {keywords.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">{t('art_style_keywords')}</p>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map(kw => (
              <Badge key={kw} color="#7C3AED">{kw}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Sample images */}
      {imageUrls.length > 0 && (
        <div className="flex gap-3 overflow-x-auto py-1">
          {imageUrls.map((url, i) => (
            <SafeImage key={i} src={url} alt={`${displayName} sample ${i + 1}`} />
          ))}
        </div>
      )}

      {/* Reference games — each links to a Google search for the title */}
      {games.length > 0 && (
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
                title={r.title}
              >
                <Gamepad2 size={12} />
                {r.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Global grounding sources panel                                    */
/* ------------------------------------------------------------------ */

function GroundingSourcesPanel({
  sources,
  t,
}: {
  sources: GroundingSource[];
  t: (k: any) => string;
}) {
  if (!sources?.length) return null;
  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
        <Globe size={14} />
        {t('art_style_sources')}
      </h3>
      <div className="flex flex-wrap gap-2">
        {sources.map((s, i) => (
          <a
            key={i}
            href={s.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-white border border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors max-w-xs truncate"
            title={s.title}
          >
            <ExternalLink size={10} className="shrink-0" />
            <span className="truncate">{s.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'art_style_analysis_v3';
const LEGACY_KEYS = ['art_style_analysis', 'art_style_analysis_v2'];

interface LlmSettings {
  provider: string;
  model: string;
  apiKey: string;
  status: string;
}

function rangeToHumanEn(range: ArtStyleTimeRange): string {
  return { '1w': 'the past 7 days', '1m': 'the past 30 days', '3m': 'the past 90 days' }[range];
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
    // Drop legacy cache entries that don't match the current schema.
    for (const k of LEGACY_KEYS) {
      try { localStorage.removeItem(k); } catch {}
    }
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed: ArtStyleAnalysis = JSON.parse(cached);
        // Defensive: every style must have the fields the UI reads
        const valid =
          Array.isArray(parsed?.styles) &&
          parsed.styles.length > 0 &&
          parsed.styles.every(
            s =>
              Array.isArray(s.references) &&
              Array.isArray(s.imageUrls) &&
              Array.isArray(s.keywords),
          );
        if (valid) {
          setAnalysis(parsed);
          if (parsed.timeRange) setTimeRange(parsed.timeRange);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }, []);

  const llmConnected = llm?.status === 'connected' && !!llm?.apiKey;
  const hasCachedResults = !!analysis;

  const generate = useCallback(() => {
    if (!llm?.apiKey) return;
    setLoading(true);
    setError(null);

    const nowIso = new Date().toISOString();
    const nowLabel = new Date().toUTCString();
    const rangeHuman = rangeToHumanEn(timeRange);

    // IMPORTANT: prompt is entirely in English. Market focus is explicitly
    // the Western / global overseas market, NOT the Chinese domestic market.
    const prompt = `You are a game art market analyst researching the GLOBAL OVERSEAS market (primarily North America, Europe, Japan, SEA — NOT the Chinese domestic market). Use Google Search to find the latest trends.

**Current timestamp:** ${nowIso} (today: ${nowLabel})
**Time range:** ${rangeHuman} from today.

**Target genre:** Female-oriented dialogue / chat-based games on Western / global markets. Examples: otome games, choice-based visual novels, chat-story apps (MeChat, Episode, Chapters, Choices, Mystic Messenger), AAA narrative romance (Love and Deepspace), indie VNs on Steam/itch.io. EXCLUDE Chinese-domestic-only titles.

**Task:** Identify the 10 MOST POPULAR art styles in this genre during ${rangeHuman}. Rank them 1-10 by popularity (consider player reception, engagement, and creator adoption).

**Sources (search English-language / Western sources):**
- Player-facing: Reddit (r/otomegames, r/visualnovels, r/mobilegaming, r/RomanceBooks), App Store US / Google Play US top charts and reviews, Steam reviews, TikTok / YouTube ad engagement on Western accounts, English game press (Gamesindustry.biz, Pocket Tactics, Rock Paper Shotgun)
- Creator-facing: ArtStation trending, DeviantArt popular, CivitAI trending models

**For each style, provide GAME TITLES ONLY for references — do NOT include URLs for references, as URLs often go stale. We will auto-generate search links from the titles.**

**Return JSON wrapped in \`\`\`json fences:**
{
  "queried_at": "${nowIso}",
  "styles": [
    {
      "rank": 1,
      "name": "English style name",
      "name_en": "English style name (same as name)",
      "description": "Why this style is trending NOW in Western markets during ${rangeHuman}. Cite specific games, player reactions, or press coverage you found. 3-4 sentences.",
      "keywords": ["semi-realism", "soft-shading", "cinematic lighting"],
      "reference_games": ["Love and Deepspace", "Mystic Messenger", "Episode: Choose Your Story"],
      "image_urls": ["https://... only include direct image URLs you are highly confident exist ..."],
      "score": 92
    }
    /* ... 9 more, 10 total ... */
  ],
  "summary": "Overall overseas-market trend overview for ${rangeHuman}."
}

**Requirements:**
- Return EXACTLY 10 styles, ranked 1-10
- "reference_games": an array of 2-5 real game titles (STRING array). NO URLs. We auto-generate Google search links.
- "image_urls": ONLY include if you are highly confident the URL is a real, accessible image. Otherwise return an empty array. Do NOT hallucinate image URLs.
- Do NOT use memorized knowledge — base everything on your search results within ${rangeHuman}
- ALL text fields (name, description, keywords, summary) MUST be in ENGLISH only. Do not translate. Do not use Chinese.`;

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
        const groundingSources = extractGroundingSources(data);
        const parsed = parseStyleResponse(text, timeRange, groundingSources);
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

          {/* Real Google Search sources (from Gemini grounding metadata) */}
          {analysis.groundingSources && analysis.groundingSources.length > 0 && (
            <GroundingSourcesPanel sources={analysis.groundingSources} t={t} />
          )}
        </div>
      )}
    </div>
  );
}
