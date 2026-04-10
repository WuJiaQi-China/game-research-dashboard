'use client';

import { useState, useCallback, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { useConfig, useSaveConfig } from '@/lib/hooks/useConfig';
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
  const [initialized, setInitialized] = useState(false);

  // Sync saved config into local state (only once)
  useEffect(() => {
    if (savedConfig && !initialized) {
      setLocalConfig(savedConfig);
      setInitialized(true);
    }
  }, [savedConfig, initialized]);

  // If config is null (not found), still show the page with empty config
  useEffect(() => {
    if (!isLoading && !savedConfig && !initialized) {
      setInitialized(true);
    }
  }, [isLoading, savedConfig, initialized]);

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

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    await saveConfigMutation.mutateAsync(localConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">{t('tab_deep')}</h1>
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
          type="button"
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
    </div>
  );
}
