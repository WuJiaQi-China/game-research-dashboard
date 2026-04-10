'use client';

import { useState, useMemo } from 'react';
import { ExternalLink, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useI18n } from '@/lib/i18n/context';
import type { ArtistRecord } from '@/lib/types';

type SortField = 'totalViews' | 'totalWorks' | 'followerCount';

interface ArtistRankingTableProps {
  artists: ArtistRecord[];
}

export function ArtistRankingTable({ artists }: ArtistRankingTableProps) {
  const { lang } = useI18n();
  const [sortField, setSortField] = useState<SortField>('totalViews');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...artists];
    copy.sort((a, b) => {
      const va = a[sortField] ?? 0;
      const vb = b[sortField] ?? 0;
      return sortAsc ? va - vb : vb - va;
    });
    return copy;
  }, [artists, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const fmtNum = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : String(n);

  const colHeader = (label: string, field: SortField) => (
    <button
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors"
    >
      {label}
      <ArrowUpDown size={12} className={sortField === field ? 'text-blue-500' : 'text-gray-300'} />
    </button>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
            <th className="py-2 px-2 w-8">#</th>
            <th className="py-2 px-2 w-10"></th>
            <th className="py-2 px-2">
              {lang === 'zh' ? '画师' : 'Artist'}
            </th>
            <th className="py-2 px-2">
              {colHeader(lang === 'zh' ? '浏览量' : 'Views', 'totalViews')}
            </th>
            <th className="py-2 px-2">
              {colHeader(lang === 'zh' ? '作品数' : 'Works', 'totalWorks')}
            </th>
            <th className="py-2 px-2 hidden md:table-cell">
              {lang === 'zh' ? '标签' : 'Tags'}
            </th>
            <th className="py-2 px-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((artist, idx) => (
            <tr
              key={artist.id}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="py-2 px-2 text-gray-400 text-xs">{idx + 1}</td>
              <td className="py-2 px-2">
                {artist.imageUrl ? (
                  <img
                    src={artist.imageUrl}
                    alt={artist.name}
                    className="w-7 h-7 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-200" />
                )}
              </td>
              <td className="py-2 px-2">
                <div className="flex flex-col">
                  <a
                    href={artist.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gray-900 hover:text-blue-600 truncate max-w-[180px]"
                  >
                    {artist.name}
                  </a>
                  <span className="text-[10px] text-gray-400">{artist.source}</span>
                </div>
              </td>
              <td className="py-2 px-2 font-medium text-gray-700">
                {fmtNum(artist.totalViews)}
              </td>
              <td className="py-2 px-2 text-gray-600">
                {artist.totalWorks}
              </td>
              <td className="py-2 px-2 hidden md:table-cell">
                <div className="flex gap-1 overflow-hidden max-w-[200px]">
                  {(artist.tags ?? []).slice(0, 3).map((tag) => (
                    <Badge key={tag} color="#6B7280" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="py-2 px-2">
                <a
                  href={artist.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-blue-500"
                >
                  <ExternalLink size={14} />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
