'use client';

import { useT } from '@/lib/i18n/context';

export default function TrendsPage() {
  const t = useT();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {t('tab_trends')}
      </h1>
      <p className="text-gray-500">{t('no_data_hint')}</p>
    </div>
  );
}
