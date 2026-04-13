'use client';

import { useI18n } from '@/lib/i18n/context';
import { ArtistCard } from './ArtistCard';
import type { ArtistRecord } from '@/lib/types';

interface ArtistGalleryProps {
  artists: ArtistRecord[];
}

export function ArtistGallery({ artists }: ArtistGalleryProps) {
  const { lang } = useI18n();
  const visible = artists.slice(0, 20);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
      {visible.map((artist) => (
        <ArtistCard
          key={artist.id}
          artist={artist}
          allArtists={artists}
          lang={lang}
        />
      ))}
    </div>
  );
}
