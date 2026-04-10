'use client';

import { useState } from 'react';
import {
  Search,
  Gamepad2,
  BookOpen,
  BookImage,
  Palette,
  ChevronLeft,
  ChevronRight,
  Languages,
  Bot,
  X,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { TYPE_LABELS } from '@/lib/constants';
import type { ContentType } from '@/lib/types';

const DEFAULT_GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

const typeFilters: { key: ContentType; icon: typeof Gamepad2 }[] = [
  { key: 'game', icon: Gamepad2 },
  { key: 'novel', icon: BookOpen },
  { key: 'comic', icon: BookImage },
  { key: 'artist', icon: Palette },
];

type LlmStatus = 'disconnected' | 'connecting' | 'connected';

export function Sidebar() {
  const { lang, setLang, t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTypes, setActiveTypes] = useState<Set<ContentType>>(new Set());

  // LLM state
  const [llmOpen, setLlmOpen] = useState(false);
  const [apiKey, setApiKey] = useState(DEFAULT_GEMINI_KEY);
  const [llmStatus, setLlmStatus] = useState<LlmStatus>('disconnected');

  const toggleType = (key: ContentType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleLang = () => setLang(lang === 'zh' ? 'en' : 'zh');

  const handleVerifyLlm = () => {
    if (!apiKey.trim()) return;
    setLlmStatus('connecting');
    // Simulate verification (replace with real Gemini API check later)
    setTimeout(() => {
      setLlmStatus(apiKey.trim().length > 5 ? 'connected' : 'disconnected');
    }, 1500);
  };

  const statusDot = {
    disconnected: 'bg-red-500',
    connecting: 'bg-yellow-500 animate-pulse',
    connected: 'bg-green-500',
  }[llmStatus];

  const statusText = {
    disconnected: lang === 'zh' ? '未连接' : 'Disconnected',
    connecting: lang === 'zh' ? '连接中...' : 'Connecting...',
    connected: lang === 'zh' ? '已连接' : 'Connected',
  }[llmStatus];

  if (collapsed) {
    return (
      <aside className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-2 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ChevronRight size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <h1 className="text-base font-semibold text-gray-800 truncate">
          Trend Crawler
        </h1>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleLang}
            className="px-2 py-1 text-xs font-medium rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            <Languages size={14} className="inline mr-1" />
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Scrollable filter area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Type Filter */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {t('content_type')}
          </h3>
          <div className="space-y-1">
            {typeFilters.map(({ key, icon: Icon }) => {
              const active = activeTypes.has(key);
              const label = TYPE_LABELS[key]?.[lang] ?? key;
              return (
                <label
                  key={key}
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                    active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleType(key)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Icon size={15} />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* LLM Connection — bottom section */}
      <div className="border-t border-gray-100 px-4 py-3">
        <button
          onClick={() => setLlmOpen(!llmOpen)}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-700"
        >
          <Bot size={16} className="text-gray-500" />
          <span className="flex-1 text-left font-medium">
            {lang === 'zh' ? '大模型' : 'LLM'}
          </span>
          <span className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
        </button>

        {/* LLM Settings Popover */}
        {llmOpen && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase">
                Gemini API
              </span>
              <button onClick={() => setLlmOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${statusDot}`} />
              <span className="text-gray-600">{statusText}</span>
            </div>

            {/* API Key */}
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setLlmStatus('disconnected');
              }}
              placeholder="API Key..."
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Verify button */}
            <button
              onClick={handleVerifyLlm}
              disabled={llmStatus === 'connecting' || !apiKey.trim()}
              className={`w-full py-1.5 rounded-md text-xs font-medium transition-colors ${
                llmStatus === 'connecting' || !apiKey.trim()
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : llmStatus === 'connected'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {llmStatus === 'connecting'
                ? (lang === 'zh' ? '验证中...' : 'Verifying...')
                : llmStatus === 'connected'
                  ? (lang === 'zh' ? '✓ 已连接' : '✓ Connected')
                  : (lang === 'zh' ? '验证连接' : 'Verify')}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
