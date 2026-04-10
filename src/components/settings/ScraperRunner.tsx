'use client';

import { useState, useEffect, useCallback } from 'react';
import { Play, Square, Terminal, CheckCircle, AlertCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase/config';
import { saveConfig } from '@/lib/firebase/firestore';
import type { ScrapeConfig, ScrapeRun } from '@/lib/types';

interface ScraperRunnerProps {
  config: Partial<ScrapeConfig>;
}

export function ScraperRunner({ config }: ScraperRunnerProps) {
  const { lang, t } = useI18n();
  const [runId, setRunId] = useState<string | null>(null);
  const [runState, setRunState] = useState<ScrapeRun | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalMessage, setFinalMessage] = useState<string | null>(null);

  const isRunning = runState?.status === 'running' || runState?.status === 'pending';

  // Subscribe to scrape run progress via Firestore onSnapshot
  useEffect(() => {
    if (!runId) return;
    const unsub = onSnapshot(doc(db, 'scrapeRuns', runId), (snap) => {
      if (snap.exists()) {
        const data = { ...snap.data(), id: snap.id } as ScrapeRun;
        setRunState(data);
        // When completed/failed/stopped, show final message
        if (data.status === 'completed') {
          setFinalMessage(
            lang === 'zh'
              ? `爬取完成！共 ${data.savedCount || 0} 条记录已保存。`
              : `Scraping complete! ${data.savedCount || 0} records saved.`
          );
        } else if (data.status === 'failed') {
          setError(data.error || 'Unknown error');
        } else if (data.status === 'stopped') {
          setFinalMessage(lang === 'zh' ? '已手动停止。' : 'Manually stopped.');
        }
      }
    });
    return unsub;
  }, [runId, lang]);

  const handleStart = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    setFinalMessage(null);
    setRunState(null);

    try {
      // Auto-save config before starting
      await saveConfig(config);

      // Call Cloud Function
      const runScraper = httpsCallable(functions, 'run_scraper');
      const result = await runScraper({});
      const data = result.data as { runId?: string; error?: string };

      if (data.error) {
        setError(data.error);
        setIsStarting(false);
        return;
      }

      if (data.runId) {
        setRunId(data.runId);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsStarting(false);
    }
  }, [config]);

  const handleStop = useCallback(async () => {
    if (!runId) return;
    try {
      const stopScraper = httpsCallable(functions, 'stop_scraper');
      await stopScraper({ runId });
    } catch (e: unknown) {
      console.warn('Stop failed:', e);
    }
  }, [runId]);

  const progress = runState?.stageProgress ?? 0;
  const stage = runState?.currentStageName ?? '';
  const message = runState?.progressMessage ?? '';
  const logLines = runState?.logLines ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{t('run_desc_help')}</p>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleStart}
          disabled={isRunning || isStarting}
          className={`
            inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${
              isRunning || isStarting
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }
          `}
        >
          <Play size={16} />
          {isStarting
            ? (lang === 'zh' ? '启动中...' : 'Starting...')
            : t('run_desc')}
        </button>
        {isRunning && (
          <button
            type="button"
            onClick={handleStop}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            <Square size={16} />
            {t('stop_scrape')}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success message */}
      {finalMessage && !error && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
          <p className="text-sm text-green-700">{finalMessage}</p>
        </div>
      )}

      {/* Progress */}
      {(isRunning || isStarting) && (
        <div className="space-y-2">
          {stage && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">{t('stage_label')}:</span> {stage}
            </p>
          )}

          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>

          {message && (
            <p className="text-xs text-gray-500">{message}</p>
          )}
        </div>
      )}

      {/* Log output */}
      {logLines.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto">
          <div className="flex items-center gap-1.5 mb-2">
            <Terminal size={12} className="text-gray-500" />
            <span className="text-xs text-gray-500">Log Output</span>
          </div>
          {logLines.map((line, i) => (
            <p key={i} className="text-xs text-green-400 font-mono leading-5">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
