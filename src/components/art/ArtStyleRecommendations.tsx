'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Play, Loader2, RefreshCw, Clock, ExternalLink, Palette,
} from 'lucide-react';
import { useI18n, useT } from '@/lib/i18n/context';
import { Badge } from '@/components/ui/Badge';
import type { ArtStyleRecommendation, ArtStyleAnalysis } from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  JSON parser                                                       */
/* ------------------------------------------------------------------ */

function parseStyleResponse(text: string): ArtStyleAnalysis | null {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  try {
    const obj = JSON.parse(cleaned);
    if (!Array.isArray(obj.styles) || obj.styles.length === 0) return null;

    const styles: ArtStyleRecommendation[] = obj.styles.map((s: any) => ({
      name: String(s.name || ''),
      nameEn: String(s.name_en ?? s.nameEn ?? ''),
      description: String(s.description || ''),
      keywords: Array.isArray(s.keywords) ? s.keywords.map(String) : [],
      facialFeatures: String(s.facial_features ?? s.facialFeatures ?? ''),
      referenceUrls: Array.isArray(s.reference_urls ?? s.referenceUrls)
        ? (s.reference_urls ?? s.referenceUrls).map(String)
        : [],
      imageUrls: Array.isArray(s.image_urls ?? s.imageUrls)
        ? (s.image_urls ?? s.imageUrls).map(String)
        : [],
      score: typeof s.score === 'number' ? Math.min(100, Math.max(0, s.score)) : 50,
    }));

    return {
      styles,
      summary: String(obj.summary || ''),
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Image with error fallback                                          */
/* ------------------------------------------------------------------ */

function SafeImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      className="h-24 w-auto rounded-lg object-cover border border-gray-200"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Style Card                                                         */
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
  const visibleImages = style.imageUrls.filter(u => u.startsWith('http'));
  const visibleRefs = style.referenceUrls.filter(u => u.startsWith('http'));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-50 text-purple-600">
            <Palette size={18} />
          </span>
          <h3 className="font-semibold text-gray-900 leading-tight">{displayName}</h3>
          {style.nameEn && lang === 'zh' && (
            <span className="text-xs text-gray-400">{style.nameEn}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-sm shrink-0">
          <span className="text-gray-400">{t('art_style_score')}</span>
          <span className="font-bold text-purple-600">{style.score}</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed">{style.description}</p>

      {/* Facial features */}
      {style.facialFeatures && (
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
          <p className="text-xs font-semibold text-amber-700 mb-1">{t('art_style_features')}</p>
          <p className="text-sm text-amber-800">{style.facialFeatures}</p>
        </div>
      )}

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
      {visibleImages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto py-1">
          {visibleImages.slice(0, 4).map((url, i) => (
            <SafeImage key={i} src={url} alt={`${displayName} sample ${i + 1}`} />
          ))}
        </div>
      )}

      {/* Reference links */}
      {visibleRefs.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1">{t('art_style_refs')}</p>
          <div className="flex flex-wrap gap-2">
            {visibleRefs.map((url, i) => {
              let label: string;
              try {
                label = new URL(url).hostname.replace('www.', '');
              } catch {
                label = 'Link';
              }
              return (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <ExternalLink size={12} />
                  {label}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'art_style_analysis';

interface LlmSettings {
  provider: string;
  model: string;
  apiKey: string;
  status: string;
}

export function ArtStyleRecommendations() {
  const t = useT();
  const { lang } = useI18n();

  const [llm, setLlm] = useState<LlmSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ArtStyleAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hydrate LLM settings + cached analysis from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('llm_settings');
      if (raw) setLlm(JSON.parse(raw));
    } catch {}
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed: ArtStyleAnalysis = JSON.parse(cached);
        if (parsed.styles?.length) setAnalysis(parsed);
      }
    } catch {}
  }, []);

  const llmConnected = llm?.status === 'connected' && !!llm?.apiKey;
  const hasCachedResults = !!analysis;

  const generate = useCallback(() => {
    if (!llm?.apiKey) return;
    setLoading(true);
    setError(null);

    const langLabel = lang === 'zh' ? 'Chinese' : 'English';

    const prompt = `You are a game art market analyst. Search the internet for the latest trends and recommend 5 art styles best suited for interactive narrative / romance games right now.

Base your analysis on the latest data from CivitAI trending models, ArtStation trends, Pixiv popular tags, and other current sources.

Return JSON wrapped in \`\`\`json fences:
{
  "styles": [
    {
      "name": "Style name in ${langLabel}",
      "name_en": "English Name",
      "description": "Recommendation reason (2-3 sentences citing real current trends you found)",
      "keywords": ["semi-realism", "soft-shading", "..."],
      "facial_features": "Distinctive facial feature description (eyes, lips, shading details)",
      "reference_urls": ["https://civitai.com/...", "https://..."],
      "image_urls": ["https://... direct image URLs ..."],
      "score": 85
    }
  ],
  "summary": "Overall art style trend overview in ${langLabel}"
}

Requirements:
- Base recommendations on the latest internet data you find, not on memorized knowledge
- reference_urls: real CivitAI model pages, ArtStation portfolio pages, etc.
- image_urls: directly embeddable image URLs (CivitAI previews, public gallery images, etc.)
- keywords: prompt keywords usable by AI art generation or art teams
- score: 0-100 market popularity score
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
        const parsed = parseStyleResponse(text);
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
  }, [llm, lang]);

  return (
    <div className="space-y-4">
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

          {analysis?.createdAt && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Clock size={12} />
              <span>{new Date(analysis.createdAt).toLocaleString()}</span>
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

      {/* Cached timestamp when LLM not connected but results exist */}
      {!llmConnected && hasCachedResults && analysis?.createdAt && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock size={12} />
          <span>{new Date(analysis.createdAt).toLocaleString()}</span>
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
            {analysis.styles.map((style, i) => (
              <StyleCard key={i} style={style} t={t} lang={lang} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
