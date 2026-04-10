'use client';

import { useCallback } from 'react';
import { Download } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import type { ContentRecord } from '@/lib/types';

interface CsvExportButtonProps {
  records: ContentRecord[];
  filename?: string;
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function CsvExportButton({
  records,
  filename = 'resources.csv',
}: CsvExportButtonProps) {
  const t = useT();

  const handleExport = useCallback(() => {
    const headers = [
      'type',
      'source',
      'title',
      'name',
      'rating',
      'tags',
      'releaseDate',
      'link',
      'description',
    ];

    const rows = records.map((r) =>
      [
        r.type,
        r.source,
        r.title,
        r.name,
        r.rating,
        (r.tags ?? []).join('; '),
        r.releaseDate,
        r.link,
        r.description,
      ]
        .map((v) => escapeCsvField(String(v ?? '')))
        .join(','),
    );

    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [records, filename]);

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <Download size={14} />
      {t('download_csv')}
    </button>
  );
}
