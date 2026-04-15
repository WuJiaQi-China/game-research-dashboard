'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type RowSelectionState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import {
  ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink, Trash2,
  Loader2, X, Search, AlertCircle, Calendar,
  Gamepad2, BookOpen, BookImage, Palette,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { SOURCE_COLORS, TYPE_LABELS } from '@/lib/constants';
import { useI18n } from '@/lib/i18n/context';
import { safeImageUrl } from '@/lib/imageUrl';
import type { ContentRecord, ContentType } from '@/lib/types';

const TYPE_ICONS: Record<ContentType, typeof Gamepad2> = {
  game: Gamepad2,
  novel: BookOpen,
  comic: BookImage,
  artist: Palette,
};
const TYPE_FILTER_ORDER: ContentType[] = ['game', 'novel', 'comic', 'artist'];

interface ResourceTableProps {
  records: ContentRecord[];
  onDelete?: (ids: string[]) => Promise<void>;
}

const columnHelper = createColumnHelper<ContentRecord>();

export function ResourceTable({ records, onDelete }: ResourceTableProps) {
  const { lang, t } = useI18n();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  // Reset page to 0 when records change (from external filter), so user isn't stuck on an empty page
  const [pageIndex, setPageIndex] = useState(0);

  // Read current column filter values (for controlled inputs)
  const titleFilter = (columnFilters.find(f => f.id === 'title')?.value as string) ?? '';
  const tagFilter = (columnFilters.find(f => f.id === 'tags')?.value as string) ?? '';
  const dateRange = (columnFilters.find(f => f.id === 'releaseDate')?.value as
    | { start?: string; end?: string }
    | undefined) ?? {};
  const activeTypes = (columnFilters.find(f => f.id === 'type')?.value as ContentType[]) ?? [];
  const activeSources = (columnFilters.find(f => f.id === 'source')?.value as string[]) ?? [];

  const setColFilter = (id: string, value: unknown) => {
    setColumnFilters(prev => {
      const rest = prev.filter(f => f.id !== id);
      const isEmpty =
        value === '' ||
        value == null ||
        (Array.isArray(value) && value.length === 0);
      if (isEmpty) return rest;
      return [...rest, { id, value }];
    });
    setPageIndex(0);
  };

  const setDateRange = (next: { start?: string; end?: string }) => {
    const cleaned: { start?: string; end?: string } = {};
    if (next.start) cleaned.start = next.start;
    if (next.end) cleaned.end = next.end;
    if (!cleaned.start && !cleaned.end) {
      setColumnFilters(prev => prev.filter(f => f.id !== 'releaseDate'));
    } else {
      setColumnFilters(prev => [
        ...prev.filter(f => f.id !== 'releaseDate'),
        { id: 'releaseDate', value: cleaned },
      ]);
    }
    setPageIndex(0);
  };

  // Functional-updater versions so rapid clicks batch correctly instead of
  // relying on a stale closure over activeTypes/activeSources.
  const toggleMultiFilter = <T,>(id: string, key: T) => {
    setColumnFilters(prev => {
      const current = (prev.find(f => f.id === id)?.value as T[]) ?? [];
      const nextValues = current.includes(key)
        ? current.filter(k => k !== key)
        : [...current, key];
      const rest = prev.filter(f => f.id !== id);
      if (nextValues.length === 0) return rest;
      return [...rest, { id, value: nextValues }];
    });
    setPageIndex(0);
  };

  const toggleType = (key: ContentType) => toggleMultiFilter<ContentType>('type', key);
  const toggleSource = (key: string) => toggleMultiFilter<string>('source', key);

  const clearColFilters = () => {
    setColumnFilters([]);
    setPageIndex(0);
  };

  // Types present in the data (only show chips for types that actually have records).
  const availableTypes = useMemo(() => {
    const present = new Set<ContentType>();
    for (const r of records) present.add(r.type);
    return TYPE_FILTER_ORDER.filter(t => present.has(t));
  }, [records]);

  // Data sources shown as chips — narrowed by active content-type filter so
  // picking "Game" only surfaces sources that have games.
  const sourceOptions = useMemo(() => {
    const base = activeTypes.length === 0
      ? records
      : records.filter(r => activeTypes.includes(r.type));
    const counts = new Map<string, number>();
    for (const r of base) counts.set(r.source, (counts.get(r.source) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [records, activeTypes]);

  // When the type filter changes, drop any active sources that no longer
  // match (e.g. user had "wattpad" selected then switched to type=game).
  useEffect(() => {
    if (activeSources.length === 0) return;
    const valid = new Set(sourceOptions.map(([src]) => src));
    const cleaned = activeSources.filter(s => valid.has(s));
    if (cleaned.length !== activeSources.length) {
      setColFilter('source', cleaned);
    }
    // Intentionally omitting setColFilter from deps — it's a closure over
    // state setters and would cause the effect to run on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceOptions]);

  const columns = useMemo(
    () => [
      // Checkbox column
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        ),
        size: 40,
        enableSorting: false,
      }),
      columnHelper.accessor('imageUrl', {
        header: () => t('col_cover'),
        cell: (info) => {
          const url = info.getValue();
          return url ? (
            <img
              src={safeImageUrl(url)}
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
        filterFn: (row, _id, value: ContentType[]) => {
          if (!value || value.length === 0) return true;
          return value.includes(row.original.type);
        },
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
        filterFn: (row, _id, value: string[]) => {
          if (!value || value.length === 0) return true;
          return value.includes(row.original.source);
        },
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
        filterFn: (row, _id, value: string) => {
          if (!value) return true;
          const q = value.toLowerCase();
          const title = (row.original.title ?? '').toLowerCase();
          const name = (row.original.name ?? '').toLowerCase();
          return title.includes(q) || name.includes(q);
        },
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
        filterFn: (row, _id, value: string) => {
          if (!value) return true;
          const q = value.toLowerCase();
          const tags = row.original.tags ?? [];
          return tags.some(tag => (tag ?? '').toLowerCase().includes(q));
        },
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
        filterFn: (row, _id, value: { start?: string; end?: string }) => {
          if (!value || (!value.start && !value.end)) return true;
          const rawDate = row.original.releaseDate;
          if (!rawDate) return false;
          const recordTs = Date.parse(rawDate);
          if (isNaN(recordTs)) return false;
          if (value.start) {
            const startTs = Date.parse(value.start);
            if (!isNaN(startTs) && recordTs < startTs) return false;
          }
          if (value.end) {
            // Interpret end as end-of-day (inclusive)
            const endTs = Date.parse(value.end + 'T23:59:59');
            if (!isNaN(endTs) && recordTs > endTs) return false;
          }
          return true;
        },
      }),
    ],
    [lang, t],
  );

  const table = useReactTable({
    data: records,
    columns,
    state: {
      sorting,
      rowSelection,
      columnFilters,
      pagination: { pageIndex, pageSize: 20 },
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function'
        ? updater({ pageIndex, pageSize: 20 })
        : updater;
      setPageIndex(next.pageIndex);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    getRowId: (row) => row.id,
  });

  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const hasColFilters = columnFilters.length > 0;

  const selectedCount = Object.keys(rowSelection).length;

  const handleDeleteConfirm = async () => {
    if (!onDelete) return;
    setDeleting(true);
    setDeleteErr(null);
    try {
      const ids = Object.keys(rowSelection);
      await onDelete(ids);
      setRowSelection({});
      setShowConfirm(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Delete failed:', e);
      setDeleteErr(msg);
      // Keep the modal open so the user sees what happened
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {/* Column filter bar */}
      <div className="mb-3 p-3 rounded-lg border border-gray-200 bg-gray-50 space-y-2.5">
        {/* Row 1: content type pills + text / date filters + actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Content type chips */}
          {availableTypes.map((key) => {
            const active = activeTypes.includes(key);
            const Icon = TYPE_ICONS[key];
            const label = TYPE_LABELS[key]?.[lang] ?? key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleType(key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            );
          })}

          {availableTypes.length > 0 && <div className="h-5 w-px bg-gray-200" />}

          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={titleFilter}
              onChange={(e) => setColFilter('title', e.target.value)}
              placeholder={t('title_filter_ph')}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <input
            type="text"
            value={tagFilter}
            onChange={(e) => setColFilter('tags', e.target.value)}
            placeholder={t('tag_filter_ph')}
            className="px-3 py-1.5 text-xs rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px] max-w-[180px]"
          />
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-gray-400 shrink-0" />
            <input
              type="date"
              value={dateRange.start ?? ''}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-2 py-1.5 text-xs rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={t('date_from')}
            />
            <span className="text-gray-400 text-xs">—</span>
            <input
              type="date"
              value={dateRange.end ?? ''}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-2 py-1.5 text-xs rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={t('date_to')}
            />
          </div>
          {hasColFilters && (
            <button
              type="button"
              onClick={clearColFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X size={12} />
              {t('clear_filters')}
            </button>
          )}
          <span className="text-xs text-gray-500 ml-auto">
            {filteredRowCount} / {records.length}
          </span>
        </div>

        {/* Row 2: data source chips (narrowed by active content-type filter) */}
        {sourceOptions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-gray-200">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider shrink-0 mr-1">
              {t('col_source')}
            </span>
            {sourceOptions.map(([src, count]) => {
              const active = activeSources.includes(src);
              const color = SOURCE_COLORS[src] ?? '#6b7280';
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => toggleSource(src)}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate max-w-[140px]">{src}</span>
                  <span className="text-gray-400">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

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
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <div className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer' : ''}`}>
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
              <tr
                key={row.id}
                className={`transition-colors ${
                  row.getIsSelected()
                    ? 'bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
              >
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

      {/* Footer: delete button + pagination */}
      <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
        <div className="flex items-center gap-3">
          <span>
            {t('n_records').replace('{}', String(filteredRowCount))}
          </span>
          {/* Select all filtered / clear */}
          {onDelete && (
            selectedCount >= filteredRowCount && filteredRowCount > 0 ? (
              <button
                type="button"
                onClick={() => setRowSelection({})}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                {t('delete_cancel')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  // Select every filtered row (not just current page)
                  const allFilteredIds = table
                    .getFilteredRowModel()
                    .rows.reduce<Record<string, boolean>>((acc, row) => {
                      acc[row.id] = true;
                      return acc;
                    }, {});
                  setRowSelection(allFilteredIds);
                }}
                disabled={filteredRowCount === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {lang === 'zh' ? `全选 (${filteredRowCount})` : `Select All (${filteredRowCount})`}
              </button>
            )
          )}
          {/* Delete button */}
          {selectedCount > 0 && onDelete && (
            <button
              type="button"
              onClick={() => { setDeleteErr(null); setShowConfirm(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer"
            >
              <Trash2 size={12} />
              {t('delete_selected').replace('{}', String(selectedCount))}
            </button>
          )}
        </div>
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

      {/* Confirm delete modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => !deleting && setShowConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{t('delete_confirm')}</h3>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer disabled:opacity-30"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              {t('delete_confirm_msg').replace('{}', String(selectedCount))}
            </p>
            {deleteErr && (
              <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <div className="flex-1 break-words">
                  <div className="font-medium">{t('delete_failed')}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-red-600">{deleteErr}</div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-30"
              >
                {t('delete_cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {t('delete_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
