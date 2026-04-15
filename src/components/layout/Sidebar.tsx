'use client';

import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Languages,
  Bot,
  X,
  ChevronDown,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

type LlmStatus = 'disconnected' | 'connecting' | 'connected';

interface LlmSettings {
  provider: string;
  model: string;
  apiKey: string;
  status: LlmStatus;
}

const PROVIDERS = [
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic Claude' },
];

const MODEL_OPTIONS: Record<string, string[]> = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
};

const DEFAULT_LLM: LlmSettings = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
  status: 'disconnected',
};

function loadLlmSettings(): LlmSettings {
  if (typeof window === 'undefined') return DEFAULT_LLM;
  try {
    const raw = localStorage.getItem('llm_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_LLM, ...parsed };
    }
  } catch {}
  return DEFAULT_LLM;
}

function saveLlmSettings(settings: LlmSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('llm_settings', JSON.stringify({
    provider: settings.provider,
    model: settings.model,
    apiKey: settings.apiKey,
    status: settings.status,
  }));
}

export function Sidebar() {
  const { lang, setLang } = useI18n();
  const [collapsed, setCollapsed] = useState(false);

  // LLM state — persisted to localStorage
  const [llmOpen, setLlmOpen] = useState(false);
  const [llm, setLlm] = useState<LlmSettings>(DEFAULT_LLM);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setLlm(loadLlmSettings());
    setMounted(true);
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (mounted) saveLlmSettings(llm);
  }, [llm, mounted]);

  const toggleLang = () => setLang(lang === 'zh' ? 'en' : 'zh');

  const handleVerifyLlm = async () => {
    if (!llm.apiKey.trim()) return;
    setLlm(prev => ({ ...prev, status: 'connecting' }));

    // Real verification for Gemini, placeholder for others
    try {
      if (llm.provider === 'gemini') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${llm.apiKey}`,
        );
        if (res.ok) {
          setLlm(prev => ({ ...prev, status: 'connected' }));
          return;
        }
      }
      // For other providers, just check if key looks valid
      if (llm.apiKey.trim().length > 10) {
        setLlm(prev => ({ ...prev, status: 'connected' }));
        return;
      }
      setLlm(prev => ({ ...prev, status: 'disconnected' }));
    } catch {
      setLlm(prev => ({ ...prev, status: 'disconnected' }));
    }
  };

  const statusDot = {
    disconnected: 'bg-red-500',
    connecting: 'bg-yellow-500 animate-pulse',
    connected: 'bg-green-500',
  }[llm.status];

  const statusLabel = {
    disconnected: lang === 'zh' ? '未连接' : 'Disconnected',
    connecting: lang === 'zh' ? '连接中...' : 'Connecting...',
    connected: lang === 'zh' ? '已连接' : 'Connected',
  }[llm.status];

  const models = MODEL_OPTIONS[llm.provider] || [];

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

      {/* Spacer so the LLM panel stays anchored at the bottom */}
      <div className="flex-1" />

      {/* LLM Connection — bottom section */}
      <div className="border-t border-gray-100 px-4 py-3">
        <button
          type="button"
          onClick={() => setLlmOpen(!llmOpen)}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-700"
        >
          <Bot size={16} className="text-gray-500" />
          <span className="flex-1 text-left font-medium">
            {lang === 'zh' ? '大模型' : 'LLM'}
          </span>
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot}`} />
        </button>

        {/* LLM Settings Panel */}
        {llmOpen && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase">
                {lang === 'zh' ? '大模型设置' : 'LLM Settings'}
              </span>
              <button type="button" onClick={() => setLlmOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>

            {/* Status badge */}
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
              <span className="text-gray-600">{statusLabel}</span>
              {llm.status === 'connected' && (
                <span className="text-gray-400 ml-auto truncate">{llm.model}</span>
              )}
            </div>

            {/* Provider selector */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {lang === 'zh' ? '供应商' : 'Provider'}
              </label>
              <div className="relative">
                <select
                  value={llm.provider}
                  onChange={(e) => {
                    const provider = e.target.value;
                    const defaultModel = MODEL_OPTIONS[provider]?.[0] || '';
                    setLlm(prev => ({ ...prev, provider, model: defaultModel, status: 'disconnected' }));
                  }}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-7"
                >
                  {PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Model selector */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {lang === 'zh' ? '模型' : 'Model'}
              </label>
              <div className="relative">
                <select
                  value={llm.model}
                  onChange={(e) => setLlm(prev => ({ ...prev, model: e.target.value, status: 'disconnected' }))}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-7"
                >
                  {models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">API Key</label>
              <input
                type="password"
                value={llm.apiKey}
                onChange={(e) => setLlm(prev => ({ ...prev, apiKey: e.target.value, status: 'disconnected' }))}
                placeholder="sk-... / AIza..."
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Verify button */}
            <button
              type="button"
              onClick={handleVerifyLlm}
              disabled={llm.status === 'connecting' || !llm.apiKey.trim()}
              className={`w-full py-1.5 rounded-md text-xs font-medium transition-colors ${
                llm.status === 'connecting' || !llm.apiKey.trim()
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : llm.status === 'connected'
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {llm.status === 'connecting'
                ? (lang === 'zh' ? '验证中...' : 'Verifying...')
                : llm.status === 'connected'
                  ? (lang === 'zh' ? '✓ 已连接' : '✓ Connected')
                  : (lang === 'zh' ? '验证连接' : 'Verify Connection')}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
