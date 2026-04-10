'use client';

import { useState, useCallback, useEffect } from 'react';
import { useT } from '@/lib/i18n/context';
import { useConfig } from '@/lib/hooks/useConfig';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { SourceToggles } from '@/components/settings/SourceToggles';
import { KeywordConfig } from '@/components/settings/KeywordConfig';
import { ScraperRunner } from '@/components/settings/ScraperRunner';
import type { ScrapeConfig } from '@/lib/types';

export default function SettingsPage() {
  const t = useT();
  const { data: savedConfig, isLoading } = useConfig();

  const [localConfig, setLocalConfig] = useState<Partial<ScrapeConfig>>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (savedConfig && !initialized) {
      setLocalConfig(savedConfig);
      setInitialized(true);
    }
  }, [savedConfig, initialized]);

  useEffect(() => {
    if (!isLoading && !savedConfig && !initialized) {
      setInitialized(true);
    }
  }, [isLoading, savedConfig, initialized]);

  const handleSourcesChange = useCallback(
    (sourcesEnabled: Record<string, boolean>) => {
      setLocalConfig((prev) => ({ ...prev, sourcesEnabled }));
    },
    []
  );

  const handleConfigChange = useCallback(
    (partial: Partial<ScrapeConfig>) => {
      setLocalConfig((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">{t('tab_deep')}</h1>
      <p className="text-sm text-gray-500">{t('scrape_config_desc')}</p>

      {/* Source Toggles */}
      <CollapsibleSection title={t('source_toggles')} defaultOpen={true}>
        <p className="text-xs text-gray-400 mb-3">{t('source_toggle_desc')}</p>
        <SourceToggles config={localConfig} onChange={handleSourcesChange} />
      </CollapsibleSection>

      {/* Keywords & Limits */}
      <CollapsibleSection title={t('kw_section')} defaultOpen={true}>
        <p className="text-xs text-gray-400 mb-3">{t('kw_desc')}</p>
        <KeywordConfig config={localConfig} onChange={handleConfigChange} />
      </CollapsibleSection>

      {/* Run Scraper — auto-saves config before starting */}
      <CollapsibleSection title={t('run_pipeline')} defaultOpen={true}>
        <ScraperRunner config={localConfig} />
      </CollapsibleSection>
    </div>
  );
}
