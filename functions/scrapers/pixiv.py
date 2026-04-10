"""
Pixiv artist scraper — fetches top illustrators from ranking.php JSON endpoint.

Uses the public ranking endpoint (no auth required).
Aggregates per-artist stats from ranking entries across up to 10 pages.
"""
import re
import time
from collections import Counter

from .base import safe_get


# Tags too generic to be meaningful style indicators
GENERIC_TAGS = {
    "users入り", "オリジナル", "original", "illustration",
    "イラスト", "落書き", "doodle", "pixiv", "R-18", "R-15",
}

PIXIV_RANKING_URL = "https://www.pixiv.net/ranking.php"

RANKING_MODE_MAP = {
    "day": "daily", "week": "weekly", "month": "monthly",
    "day_female": "daily_female", "week_original": "weekly_original",
    # Also accept Pixiv's native format directly
    "daily": "daily", "weekly": "weekly", "monthly": "monthly",
    "daily_female": "daily_female", "weekly_original": "weekly_original",
}


def scrape_pixiv_artists(
    keywords,
    max_per_keyword=20,
    max_total=100,
    ranking_mode="week",
    nsfw_filter=True,
) -> list[dict]:
    """Scrape top Pixiv illustrators from the public ranking JSON endpoint.

    Phase A: Fetch ranking pages (up to 10 pages = 500 works).
    Phase B: Aggregate per-artist, build output records.

    Returns list[dict] with camelCase Firestore-ready records.
    """
    mode = RANKING_MODE_MAP.get(ranking_mode, "weekly")

    print(f"  [pixiv] Starting ranking scrape (mode={mode})...", flush=True)

    # -- Phase A: Fetch all ranking pages --
    # {user_id: {"name": str, "profile_img": str, "works": [...]}}
    artists: dict = {}
    total_fetched = 0
    max_pages = 10  # Pixiv ranking: 500 entries / 10 pages

    for page in range(1, max_pages + 1):
        params = {"mode": mode, "content": "illust", "format": "json", "p": page}
        r = safe_get(PIXIV_RANKING_URL, params=params)
        if not r:
            print(f"  [pixiv] Ranking page {page} fetch failed", flush=True)
            break
        try:
            data = r.json()
        except Exception:
            print(f"  [pixiv] Ranking page {page} JSON parse failed", flush=True)
            break

        contents = data.get("contents", [])
        if not contents:
            break

        for item in contents:
            uid = item.get("user_id")
            if not uid:
                continue
            uid = str(uid)

            if uid not in artists:
                artists[uid] = {
                    "name": item.get("user_name", ""),
                    "profile_img": item.get("profile_img", ""),
                    "works": [],
                }

            # Parse tags (may be list or comma-separated string)
            tags_raw = item.get("tags", [])
            if isinstance(tags_raw, str):
                tags_raw = [t.strip() for t in tags_raw.split(",") if t.strip()]

            # NSFW filter
            if nsfw_filter:
                _nsfw_tags = {"R-18", "R-15", "R18", "R15"}
                if any(t in _nsfw_tags for t in tags_raw):
                    continue

            artists[uid]["works"].append({
                "illust_id": item.get("illust_id"),
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "tags": tags_raw,
                "view_count": item.get("view_count", 0),
                "rating_count": item.get("rating_count", 0),
                "rank": item.get("rank", 0),
            })

        total_fetched += len(contents)
        print(f"  [pixiv] Ranking page {page}/{max_pages} ({total_fetched} works)", flush=True)
        time.sleep(1.0)

        # Stop when there is no next page
        if not data.get("next"):
            break

    if not artists:
        print("  [pixiv] No ranking data", flush=True)
        return []

    print(f"  [pixiv] Ranking fetch done: {total_fetched} works, {len(artists)} artists", flush=True)

    # -- Phase B: Per-artist aggregation, build records --
    results: list[dict] = []
    sorted_artists = sorted(
        artists.items(),
        key=lambda x: sum(w["view_count"] for w in x[1]["works"]),
        reverse=True,
    )[:max_total]

    for idx, (uid, info) in enumerate(sorted_artists):
        works = info["works"]
        name = info["name"]

        # Aggregate tags + stats
        tag_counter: Counter = Counter()
        total_views = 0
        total_ratings = 0
        for w in works:
            for t in w["tags"]:
                if t and t not in GENERIC_TAGS and not re.match(r'^\d+users入り$', t):
                    tag_counter[t] += 1
            total_views += w.get("view_count", 0)
            total_ratings += w.get("rating_count", 0)

        style_tags = [t for t, _ in tag_counter.most_common(15)]
        genre_spec = style_tags[:3]

        # Sample works (top 5 by view count)
        top_works = sorted(works, key=lambda w: w.get("view_count", 0), reverse=True)[:5]
        sample_works = []
        for w in top_works:
            thumb_url = w.get("url", "")
            work_id = w.get("illust_id", idx)
            sample_works.append({
                "illustId": work_id,
                "title": w.get("title", ""),
                "imageUrl": thumb_url,
                "coverStoragePath": "",
                "viewCount": w.get("view_count", 0),
                "ratingCount": w.get("rating_count", 0),
                "tags": w.get("tags", [])[:8],
            })

        # Profile image URL (no local download needed)
        profile_img = info.get("profile_img", "")

        # Best rank across all ranking entries
        best_rank = min(w["rank"] for w in works) if works else 0

        record = {
            "id": f"pixiv_user_{uid}",
            "name": name,
            "title": name,
            "type": "artist",
            "source": "pixiv.net",
            "description": "",
            "imageUrl": profile_img,
            "coverStoragePath": "",
            "link": f"https://www.pixiv.net/users/{uid}",
            "tags": style_tags,
            "rating": f"{total_views:,} views",
            "releaseDate": "",
            "searchKeywords": ["(ranking)"],
            "followerCount": 0,
            "totalWorks": len(works),
            "totalBookmarks": total_views,  # Use views as proxy (ranking has no bookmark count)
            "totalViews": total_views,
            "totalRatings": total_ratings,
            "bestRank": best_rank,
            "sampleWorks": sample_works,
            "toolsMedium": [],
            "genreSpecialization": genre_spec,
        }
        results.append(record)

        if (idx + 1) % 10 == 0 or idx == len(sorted_artists) - 1:
            print(
                f"  [pixiv] Artist aggregation [{idx + 1}/{len(sorted_artists)}]",
                flush=True,
            )

    print(f"  [pixiv] Done, {len(results)} artists collected", flush=True)
    return results
