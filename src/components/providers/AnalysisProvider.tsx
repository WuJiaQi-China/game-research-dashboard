'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { TrendAnalysis, TrendItem, ContentRecord, HookType } from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  JSON parser (same logic, lives here now)                          */
/* ------------------------------------------------------------------ */

function parseTrendResponse(
  text: string,
): { trends: TrendItem[]; summary: string } | null {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  try {
    const obj = JSON.parse(cleaned);
    if (!Array.isArray(obj.trends) || obj.trends.length === 0) return null;

    const trends: TrendItem[] = obj.trends.map((t: any, i: number) => ({
      rank: typeof t.rank === 'number' ? t.rank : i + 1,
      name: String(t.name || ''),
      description: String(t.description || ''),
      representativeTags: Array.isArray(t.representativeTags ?? t.representative_tags)
        ? (t.representativeTags ?? t.representative_tags).map(String)
        : [],
      exampleTitles: Array.isArray(t.exampleTitles ?? t.example_titles)
        ? (t.exampleTitles ?? t.example_titles).map(String)
        : [],
      score: typeof t.score === 'number' ? Math.min(100, Math.max(0, t.score)) : 50,
      adCreatives: Array.isArray(t.adCreatives ?? t.ad_creatives)
        ? (t.adCreatives ?? t.ad_creatives).map((c: any) => ({
            visualDescription: String(c.visualDescription ?? c.visual_description ?? ''),
            hookType: (['text_overlay', 'choice', 'button', 'swipe', 'slider'] as HookType[]).includes(
              c.hookType ?? c.hook_type,
            )
              ? (c.hookType ?? c.hook_type)
              : 'text_overlay',
            hookContent: String(c.hookContent ?? c.hook_content ?? ''),
          }))
        : undefined,
    }));
    return { trends, summary: String(obj.summary || '') };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

interface AnalysisContextType {
  analyzing: boolean;
  analysis: TrendAnalysis | null;
  rawFallback: string | null;
  error: string | null;
  startAnalysis: (apiKey: string, model: string, records: ContentRecord[], lang: 'zh' | 'en') => void;
}

const AnalysisContext = createContext<AnalysisContextType>({
  analyzing: false,
  analysis: null,
  rawFallback: null,
  error: null,
  startAnalysis: () => {},
});

const STORAGE_KEY = 'trend_analysis';

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<TrendAnalysis | null>(null);
  const [rawFallback, setRawFallback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: TrendAnalysis = JSON.parse(raw);
        if (parsed.trends?.length) setAnalysis(parsed);
      }
    } catch {}
  }, []);

  const startAnalysis = useCallback((
    apiKey: string,
    model: string,
    records: ContentRecord[],
    lang: 'zh' | 'en',
  ) => {
    setAnalyzing(true);
    setError(null);

    const sample = records.slice(0, 200).map(r => {
      const tags = (r.tags ?? []).slice(0, 5).join(', ');
      return `- ${r.title} [${r.source}] tags: ${tags}`;
    }).join('\n');

    const prompt = `You are a content trend analyst specializing in games, novels, and comics.
Analyze the following ${records.length} content records and identify the top 10 trends.

Return a JSON object with this exact structure:
{
  "trends": [
    {
      "rank": 1,
      "name": "trend name",
      "description": "2-3 sentence description of this trend",
      "representative_tags": ["tag1", "tag2", "tag3"],
      "example_titles": ["title1", "title2", "title3"],
      "score": 85,
      "ad_creatives": [
        {
          "visual_description": "Vivid visual scene for AI image generation (describe characters, pose, setting, lighting, mood)",
          "hook_type": "text_overlay",
          "hook_content": "The actual interaction text"
        }
      ]
    }
  ],
  "summary": "A 2-3 sentence overall summary of the content landscape"
}

Rules:
- rank: 1-10, ordered by prominence
- score: 0-100 integer representing relative popularity
- representative_tags: 3-6 tags most associated with this trend
- example_titles: 2-4 actual titles from the data
- ad_creatives: exactly 3 per trend, each must use a DIFFERENT hook_type
  - hook_type: one of "text_overlay", "choice", "button", "swipe", "slider"
  - For "text_overlay": a dramatic quote or statement
  - For "choice": 2-3 options separated by " | "
  - For "button": a single CTA button text
  - For "swipe": "LEFT: option / RIGHT: option" format
  - For "slider": "Label: Min ← → Max" format
- Respond in ${lang === 'zh' ? 'Chinese' : 'English'}

Records:
${sample}`;

    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.5-flash'}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      },
    )
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = parseTrendResponse(text);
        if (parsed) {
          const trendAnalysis: TrendAnalysis = {
            id: crypto.randomUUID(),
            lang,
            trends: parsed.trends,
            summary: parsed.summary,
            createdAt: new Date().toISOString(),
            recordCount: records.length,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(trendAnalysis));
          setAnalysis(trendAnalysis);
          setRawFallback(null);
        } else {
          setRawFallback(text);
          setAnalysis(null);
        }
      })
      .catch(e => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setAnalyzing(false);
      });
  }, []);

  return (
    <AnalysisContext.Provider value={{ analyzing, analysis, rawFallback, error, startAnalysis }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  return useContext(AnalysisContext);
}
