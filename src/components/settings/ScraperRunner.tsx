'use client';

import { useState } from 'react';
import { Play, Square, Terminal } from 'lucide-react';
import { useT } from '@/lib/i18n/context';

export function ScraperRunner() {
  const t = useT();
  const [isRunning, setIsRunning] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [message, setMessage] = useState('');

  const handleStart = () => {
    setIsRunning(true);
    setLogLines([]);
    setProgress(0);
    setStage('Initializing...');
    setMessage(t('scrape_progress_hint'));

    // Simulate placeholder progress
    const stages = ['Initializing', 'VNDB', 'itch.io', 'Steam', 'Pixiv', 'Finalizing'];
    let stageIndex = 0;

    const interval = setInterval(() => {
      stageIndex++;
      if (stageIndex >= stages.length) {
        clearInterval(interval);
        setIsRunning(false);
        setStage('');
        setProgress(100);
        setMessage(t('scrape_ended'));
        setLogLines((prev) => [...prev, '[done] Scraping process placeholder complete.']);
        return;
      }
      const pct = Math.round((stageIndex / stages.length) * 100);
      setProgress(pct);
      setStage(stages[stageIndex]);
      setLogLines((prev) => [
        ...prev,
        `[${stageIndex}/${stages.length}] Scraping ${stages[stageIndex]}...`,
      ]);
    }, 1500);

    // Store interval ID on window for cleanup
    (window as unknown as Record<string, unknown>).__scraperInterval = interval;
  };

  const handleStop = () => {
    setIsRunning(false);
    setStage('');
    setMessage(t('stopped_msg'));
    setLogLines((prev) => [...prev, '[stopped] Manually stopped.']);
    const interval = (window as unknown as Record<string, unknown>).__scraperInterval as ReturnType<typeof setInterval> | undefined;
    if (interval) clearInterval(interval);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{t('run_desc_help')}</p>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleStart}
          disabled={isRunning}
          className={`
            inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${
              isRunning
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }
          `}
        >
          <Play size={16} />
          {t('run_desc')}
        </button>
        {isRunning && (
          <button
            onClick={handleStop}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            <Square size={16} />
            {t('stop_scrape')}
          </button>
        )}
      </div>

      {/* Progress */}
      {(isRunning || progress > 0) && (
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
              style={{ width: `${progress}%` }}
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
