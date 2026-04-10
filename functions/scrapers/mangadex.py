"""MangaDex scraper — manga/comic platform via public API."""
import time

import requests

from .base import safe_get, download_cover


def scrape_mangadex(keywords, max_per_keyword=50, max_total=300):
    """Search MangaDex manga via their public API. Returns type='comic' records."""
    comics = {}  # manga_id -> record

    for ki, kw in enumerate(keywords):
        if len(comics) >= max_total:
            break
        offset = 0
        fetched_kw = 0
        while fetched_kw < max_per_keyword and len(comics) < max_total:
            if kw == "__TOP__":
                api_url = (
                    f"https://api.mangadex.org/manga"
                    f"?limit=20&offset={offset}"
                    f"&includes[]=cover_art&includes[]=author"
                    f"&order[followedCount]=desc"
                    f"&availableTranslatedLanguage[]=en"
                )
            else:
                api_url = (
                    f"https://api.mangadex.org/manga"
                    f"?title={requests.utils.quote(kw)}"
                    f"&limit=20&offset={offset}"
                    f"&includes[]=cover_art&includes[]=author"
                    f"&order[followedCount]=desc"
                    f"&availableTranslatedLanguage[]=en"
                )
            r = safe_get(api_url)
            if not r:
                break
            try:
                data = r.json()
            except Exception:
                break
            mangas = data.get("data", [])
            if not mangas:
                break
            for manga in mangas:
                if fetched_kw >= max_per_keyword or len(comics) >= max_total:
                    break
                mid = manga.get("id", "")
                if mid in comics:
                    if kw not in comics[mid]["searchKeywords"]:
                        comics[mid]["searchKeywords"].append(kw)
                    continue
                attrs = manga.get("attributes", {})
                # Title (prefer English, fallback to ja-ro, ja)
                titles = attrs.get("title", {})
                title = titles.get("en") or titles.get("ja-ro") or titles.get("ja") or ""
                if not title:
                    for v in titles.values():
                        if v:
                            title = v
                            break
                if not title:
                    continue
                # Description
                descs = attrs.get("description", {})
                desc = descs.get("en") or descs.get("ja") or ""
                for v in descs.values():
                    if v and not desc:
                        desc = v
                desc = desc[:1500]
                # Tags
                tags = [t["attributes"]["name"].get("en", "")
                        for t in attrs.get("tags", [])
                        if t.get("attributes", {}).get("name", {}).get("en")]
                # Release year
                year = attrs.get("year")
                release_date = str(year) if year else ""
                # Status -> rating field
                status = attrs.get("status", "")
                rating = status.capitalize() if status else ""
                # Cover image and author
                cover_filename = ""
                author_name = ""
                for rel in manga.get("relationships", []):
                    if rel["type"] == "cover_art":
                        cover_filename = rel.get("attributes", {}).get("fileName", "")
                    elif rel["type"] == "author":
                        author_name = rel.get("attributes", {}).get("name", "")
                img_url = f"https://uploads.mangadex.org/covers/{mid}/{cover_filename}" if cover_filename else ""
                gid = f"mangadex_{mid[:12]}"
                cover_url = download_cover(img_url, gid)
                if author_name and desc:
                    desc = f"By {author_name}. {desc}"
                elif author_name:
                    desc = f"By {author_name}"
                comics[mid] = {
                    "id": gid,
                    "name": title,
                    "title": title,
                    "type": "comic",
                    "source": "mangadex.org",
                    "description": desc,
                    "imageUrl": img_url,
                    "coverStoragePath": "",
                    "link": f"https://mangadex.org/title/{mid}",
                    "tags": tags,
                    "rating": rating,
                    "releaseDate": release_date,
                    "searchKeywords": [kw],
                }
                fetched_kw += 1
            offset += 20
            if len(mangas) < 20:
                break
            time.sleep(0.4)  # MangaDex rate limit: 5 req/s

    # Phase 2: Batch fetch rating statistics
    all_ids = list(comics.keys())
    for batch_start in range(0, len(all_ids), 50):
        batch_ids = all_ids[batch_start:batch_start + 50]
        params = "&".join(f"manga[]={mid}" for mid in batch_ids)
        stats_url = f"https://api.mangadex.org/statistics/manga?{params}"
        r = safe_get(stats_url)
        if r:
            try:
                stats_data = r.json().get("statistics", {})
                for mid in batch_ids:
                    s = stats_data.get(mid, {})
                    avg = s.get("rating", {}).get("average")
                    follows = s.get("follows", 0)
                    rating_parts = []
                    if avg:
                        rating_parts.append(f"★ {avg:.1f}/10")
                    if follows:
                        if follows >= 10000:
                            rating_parts.append(f"{follows/1000:.1f}K follows")
                        else:
                            rating_parts.append(f"{follows} follows")
                    if rating_parts:
                        comics[mid]["rating"] = ", ".join(rating_parts)
            except Exception:
                pass
        time.sleep(0.3)

    return list(comics.values())
