'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { SOURCE_COLORS, TYPE_LABELS } from '@/lib/constants';
import { useI18n } from '@/lib/i18n/context';
import type { ContentRecord } from '@/lib/types';

interface ResourceTableProps {
  records: ContentRecord[];
}

const columnHelper = createColumnHelper<ContentRecord>();

export function ResourceTable({ records }: ResourceTableProps) {
  const { lang, t } = useI18n();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('imageUrl', {
        header: () => t('col_cover'),
        cell: (info) => {
          const url = info.getValue();
          return url ? (
            <img
              src={url}
              alt=""
              className="w-10 h-10 rounded object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-gray-100" />
          );
        },
        enableSorting: false,
        size: 56,
      }),
      columnHelper.accessor('type', {
        header: () => t('col_type'),
        cell: (info) => {
          const v = info.getValue();
          const label = TYPE_LABELS[v]?.[lang] ?? v;
          return <Badge color="#6366f1">{label}</Badge>;
        },
        size: 100,
      }),
      columnHelper.accessor('source', {
        header: () => t('col_source'),
        cell: (info) => {
          const src = info.getValue();
          return (
            <Badge color={SOURCE_COLORS[src] ?? '#6b7280'}>{src}</Badge>
          );
        },
        size: 110,
      }),
      columnHelper.accessor('title', {
        header: () => t('col_title'),
        cell: (info) => {
          const row = info.row.original;
          const title = info.getValue() || row.name || '(untitled)';
          return row.link ? (
            <a
              href={row.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 max-w-[260px] truncate"
              title={title}
            >
              {title}
              <ExternalLink size={12} className="shrink-0" />
            </a>
          ) : (
            <span className="max-w-[260px] truncate block" title={title}>
              {title}
            </span>
          );
        },
        size: 280,
      }),
      columnHelper.accessor('rating', {
        header: () => t('col_rating'),
        cell: (info) => {
          const v = info.getValue();
          return v ? (
            <span className="text-sm text-gray-700">{v}</span>
          ) : (
            <span className="text-gray-300">-</span>
          );
        },
        size: 80,
      }),
      columnHelper.accessor('tags', {
        header: () => t('col_tags'),
        cell: (info) => {
          const tags = info.getValue() ?? [];
          const visible = tags.slice(0, 3);
          const extra = tags.length - 3;
          return (
            <div className="flex items-center gap-1 overflow-hidden">
              {visible.map((tag) => (
                <Badge key={tag} color="#8b5cf6" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
              {extra > 0 && (
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  +{extra}
                </span>
              )}
            </div>
          );
        },
        enableSorting: false,
        size: 200,
      }),
      columnHelper.accessor('releaseDate', {
        header: () => t('col_date'),
        cell: (info) => {
          const v = info.getValue();
          return (
            <span className="text-sm text-gray-600 whitespace-nowrap">
              {v || '-'}
            </span>
          );
        },
        size: 110,
      }),
    ],
    [lang, t],
  );

  const table = useReactTable({
    data: records,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1 cursor-pointer">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getCanSort() && (
                        <ArrowUpDown size={12} className="text-gray-400" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
        <span>
          {t('n_records').replace('{}', String(records.length))}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
