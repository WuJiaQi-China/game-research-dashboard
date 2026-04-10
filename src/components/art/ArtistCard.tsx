'use client';

import { useState, useRef, useEffect } from 'react';
import { ExternalLink, ChevronDown, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { findSimilarArtists } from '@/lib/analysis/jaccardSimilarity';
import type { ArtistRecord } from '@/lib/types';

interface ArtistCardProps {
  artist: ArtistRecord;
  allArtists: ArtistRecord[];
  lang: 'zh' | 'en';
}

export function ArtistCard({ artist, allArtists, lang }: ArtistCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    if (!showDetails) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowDetails(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDetails]);

  const samples = (artist.sampleWorks ?? []).slice(0, 4);
  const similar = showDetails
    ? findSimilarArtists(artist.tags ?? [], allArtists, artist.id, 4)
    : [];

  const fmtNum = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : String(n);

  return (
    <div className="relative bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Thumbnail row */}
      {samples.length > 0 && (
        <div className="flex gap-1 overflow-hidden h-[70px] bg-gray-100">
          {samples.map((sw, i) => (
            <img
              key={sw.illustId || i}
              src={sw.imageUrl}
              alt={sw.title}
              className="h-[70px] w-auto object-cover rounded"
              loading="lazy"
            />
          ))}
        </div>
      )}

      {/* Card body */}
      <div className="p-3 space-y-1.5">
        {/* Name + source */}
        <div className="flex items-center gap-2">
          <a
            href={artist.link}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-sm text-gray-900 hover:text-blue-600 truncate"
          >
            {artist.name}
          </a>
          <span className="text-[10px] text-gray-400 shrink-0">{artist.source}</span>
        </div>

        {/* Stats */}
        <p className="text-xs text-gray-500">
          {fmtNum(artist.totalViews)} {lang === 'zh' ? '浏览' : 'views'}
          {' | '}
          {artist.totalWorks} {lang === 'zh' ? '作品' : 'works'}
          {artist.bestRank > 0 && ` | #${artist.bestRank}`}
        </p>

        {/* Details toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
        >
          <ChevronDown
            size={14}
            className={`transition-transform ${showDetails ? 'rotate-180' : ''}`}
          />
          {lang === 'zh' ? '详情' : 'Details'}
        </button>
      </div>

      {/* Details panel */}
      {showDetails && (
        <div
          ref={panelRef}
          className="absolute left-0 right-0 top-full z-30 bg-white border border-gray-200 rounded-b-xl shadow-lg p-4 space-y-3 max-h-[420px] overflow-y-auto"
        >
          <div className="flex justify-between items-start">
            <h4 className="font-semibold text-sm text-gray-900">{artist.name}</h4>
            <button
              onClick={() => setShowDetails(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>

          {/* Description */}
          {artist.description && (
            <p className="text-xs text-gray-600 line-clamp-3">{artist.description}</p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
            <div>
              <span className="text-gray-400">{lang === 'zh' ? '来源' : 'Source'}</span>
              <p className="font-medium">{artist.source}</p>
            </div>
            <div>
              <span className="text-gray-400">{lang === 'zh' ? '浏览量' : 'Views'}</span>
              <p className="font-medium">{fmtNum(artist.totalViews)}</p>
            </div>
            <div>
              <span className="text-gray-400">{lang === 'zh' ? '作品数' : 'Works'}</span>
              <p className="font-medium">{artist.totalWorks}</p>
            </div>
          </div>

          {/* Tags */}
          {(artist.tags?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 mb-1">
                {lang === 'zh' ? '标签' : 'Tags'}
              </p>
              <div className="flex flex-wrap gap-1">
                {artist.tags.map((tag) => (
                  <Badge key={tag} color="#6B7280" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Similar artists */}
          {similar.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 mb-1">
                {lang === 'zh' ? '相似画风' : 'Similar Style'}
              </p>
              <div className="space-y-1.5">
                {similar.map((s) => (
                  <div
                    key={s.record.id}
                    className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <a
                        href={s.record.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-gray-800 hover:text-blue-600 truncate"
                      >
                        {s.record.name}
                      </a>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {s.record.source}
                      </span>
                    </div>
                    <span className="text-blue-500 font-medium shrink-0 ml-2">
                      {Math.round(s.score * 100)}%
                    </span>
                  </div>
                ))}
                {similar.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-[10px] text-gray-400">
                      {lang === 'zh' ? '共同标签:' : 'Common:'}
                    </span>
                    {similar[0].commonTags.slice(0, 6).map((t) => (
                      <Badge key={t} color="#0096FA" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* External link */}
          {artist.link && (
            <a
              href={artist.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
            >
              <ExternalLink size={12} />
              {lang === 'zh' ? '访问主页' : 'Visit Profile'}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
