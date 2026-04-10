'use client';

import { useT } from '@/lib/i18n/context';

export default function ArtPage() {
  const t = useT();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {t('tab_art')}
      </h1>
      <p className="text-gray-500">{t('art_no_data')}</p>
    </div>
  );
}
