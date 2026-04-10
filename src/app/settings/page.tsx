'use client';

import { useState, useCallback, useEffect } from 'react';
import { Save, Bot, Key, CheckCircle } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { useConfig, useSaveConfig } from '@/lib/hooks/useConfig';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { SourceToggles } from '@/components/settings/SourceToggles';
import { KeywordConfig } from '@/components/settings/KeywordConfig';
import { ScraperRunner } from '@/components/settings/ScraperRunner';
import type { ScrapeConfig } from '@/lib/types';

export default function SettingsPage() {
  const t = useT();
  const { data: savedConfig, isLoading } = useConfig();
  const saveConfigMutation = useSaveConfig();

  const [localConfig, setLocalConfig] = useState<Partial<ScrapeConfig>>({});
  const [saved, setSaved] = useState(false);

  // LLM settings local state (placeholder)
  const [apiKey, setApiKey] = useState('');
  const [llmVerified, setLlmVerified] = useState(false);
  const [llmVerifying, setLlmVerifying] = useState(false);

  // Sync saved config into local state
  useEffect(() => {
    if (savedConfig) {
      setLocalConfig(savedConfig);
    }
  }, [savedConfig]);

  const handleSourcesChange = useCallback(
    (sourcesEnabled: Record<string, boolean>) => {
      setLocalConfig((prev) => ({ ...prev, sourcesEnabled }));
      setSaved(false);
    },
    []
  );

  const handleConfigChange = useCallback(
    (partial: Partial<ScrapeConfig>) => {
      setLocalConfig((prev) => ({ ...prev, ...partial }));
      setSaved(false);
    },
    []
  );

  const handleSave = async () => {
    await saveConfigMutation.mutateAsync(localConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleVerifyLlm = () => {
    setLlmVerifying(true);
    // Placeholder -- no real verification yet
    setTimeout(() => {
      setLlmVerifying(false);
      if (apiKey.trim().length > 0) {
        setLlmVerified(true);
      }
    }, 1500);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">{t('scrape_config')}</h1>
      <p className="text-sm text-gray-500">{t('scrape_config_desc')}</p>

      {/* Scrape Configuration */}
      <CollapsibleSection title={t('source_toggles')} defaultOpen={true}>
        <p className="text-xs text-gray-400 mb-3">{t('source_toggle_desc')}</p>
        <SourceToggles config={localConfig} onChange={handleSourcesChange} />
      </CollapsibleSection>

      <CollapsibleSection title={t('kw_section')} defaultOpen={true}>
        <p className="text-xs text-gray-400 mb-3">{t('kw_desc')}</p>
        <KeywordConfig config={localConfig} onChange={handleConfigChange} />
      </CollapsibleSection>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saveConfigMutation.isPending}
          className={`
            inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors
            ${
              saveConfigMutation.isPending
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }
          `}
        >
          <Save size={16} />
          {t('save_config')}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-green-600">
            <CheckCircle size={14} />
            {t('config_saved')}
          </span>
        )}
      </div>

      {/* Run Scraper */}
      <CollapsibleSection title={t('run_pipeline')} defaultOpen={false}>
        <ScraperRunner />
      </CollapsibleSection>

      {/* LLM Settings placeholder */}
      <CollapsibleSection title={t('llm_settings')} defaultOpen={false}>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Bot size={20} className="text-gray-400 mt-0.5 shrink-0" />
            <p className="text-sm text-gray-500">{t('llm_desc')}</p>
          </div>

          {/* Gemini API Key input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('llm_gemini_key')} - {t('llm_api_key')}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Key
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setLlmVerified(false);
                  }}
                  placeholder="AIza..."
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleVerifyLlm}
                disabled={llmVerifying || !apiKey.trim()}
                className={`
                  inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                  ${
                    llmVerifying || !apiKey.trim()
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }
                `}
              >
                {llmVerifying ? t('llm_verifying') : t('llm_verify')}
              </button>
            </div>
            {llmVerified && (
              <p className="text-sm text-green-600 mt-1">{t('llm_ok')}</p>
            )}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
