/**
 * Rewrite hotlink-protected image URLs to a proxy that strips the referer check.
 *
 * Pixiv's i.pximg.net CDN requires `Referer: https://www.pixiv.net/` on every
 * image request. Browsers cannot set a custom Referer header on <img> tags, so
 * any direct load from a non-pixiv.net page returns HTTP 403. i.pixiv.re is a
 * widely-used open mirror that proxies the same paths without the check.
 *
 * Other image CDNs (ArtStation, MangaDex, etc.) are passed through unchanged.
 */
export function safeImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.includes('pximg.net')) {
    return url
      .replace('://i.pximg.net', '://i.pixiv.re')
      .replace('://s.pximg.net', '://i.pixiv.re');
  }
  return url;
}
