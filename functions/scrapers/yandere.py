"""
Yande.re artist scraper — fetches top illustrators via the Moebooru tag/post API.

Uses the public Yande.re API (no auth required).
Phase A: Fetch top artist tags sorted by post count.
Phase B: For each artist, fetch top-scored posts and aggregate style tags.
"""
import time
from collections import Counter

from scrapers.base import safe_get


YANDERE_TAG_URL = "https://yande.re/tag.json"
YANDERE_POST_URL = "https://yande.re/post.json"

# Tags that are too generic / meta to be useful style indicators
_SKIP_TAGS = frozenset({
    "highres", "tagme", "scanning_artifacts",
    "scan", "crease", "fixme", "screening",
})


def scrape_yandere_artists(
    keywords,
    max_per_keyword=20,
    max_total=100,
    nsfw_filter=True,
) -> list[dict]:
    """Scrape top Yande.re illustrators via the Moebooru API.

    Phase A: Fetch top artist tags (by post count).
    Phase B: Per-artist post fetch with score ordering, aggregate style tags.

    Returns list[dict] with camelCase Firestore-ready records.
    """
    rating_tag = "rating:safe" if nsfw_filter else ""

    print(
        f"  [yandere] Starting artist fetch (nsfw_filter={nsfw_filter})...",
        flush=True,
    )

    # -- Phase A: Fetch top artist tags --
    r = safe_get(YANDERE_TAG_URL, params={
        "limit": min(max_total * 2, 500),
        "order": "count",
        "type": 1,  # type=1 is "artist" in Moebooru
    })
    if not r:
        print("  [yandere] Artist tag API failed", flush=True)
        return []

    try:
        artist_tags = r.json()
    except Exception:
        print("  [yandere] Artist tag JSON parse failed", flush=True)
        return []

    # Filter out artists with fewer than 10 posts
    artist_tags = [a for a in artist_tags if a.get("count", 0) >= 10][:max_total]
    if not artist_tags:
        print("  [yandere] Not enough artist data", flush=True)
        return []

    total = len(artist_tags)
    print(f"  [yandere] Found {total} artists, fetching posts...", flush=True)

    # -- Phase B: Per-artist post fetch --
    results: list[dict] = []

    for idx, atag in enumerate(artist_tags):
        artist_name = atag.get("name", "")
        post_count = atag.get("count", 0)
        if not artist_name:
            continue

        tags_query = f"{artist_name} order:score"
        if rating_tag:
            tags_query += f" {rating_tag}"

        try:
            pr = safe_get(YANDERE_POST_URL, params={"limit": 15, "tags": tags_query})
            posts = pr.json() if pr else []
        except Exception:
            posts = []

        if not posts:
            time.sleep(0.3)
            continue

        # Aggregate style tags
        tag_counter: Counter = Counter()
        total_score = 0
        for p in posts:
            for t in p.get("tags", "").split():
                # Skip the artist's own tag and generic/meta tags
                if t == artist_name or t in _SKIP_TAGS:
                    continue
                tag_counter[t] += 1
            total_score += p.get("score", 0)

        style_tags = [t for t, _ in tag_counter.most_common(15)]
        genre_spec = style_tags[:3]

        # Sample works (top 5 scored posts)
        sample_works = []
        for p in posts[:5]:
            preview_url = p.get("preview_url", "")
            pid = p.get("id", idx)
            sample_works.append({
                "illustId": pid,
                "title": "",
                "imageUrl": preview_url,
                "coverStoragePath": "",
                "viewCount": p.get("score", 0),
                "ratingCount": p.get("score", 0),
                "tags": p.get("tags", "").split()[:8],
            })

        # Build artist record
        record = {
            "id": f"yandere_artist_{artist_name}",
            "name": artist_name.replace("_", " ").title(),
            "title": artist_name.replace("_", " ").title(),
            "type": "artist",
            "source": "yande.re",
            "description": "",
            "imageUrl": sample_works[0]["imageUrl"] if sample_works else "",
            "coverStoragePath": "",
            "link": f"https://yande.re/post?tags={artist_name}",
            "tags": style_tags,
            "rating": f"{total_score:,} score | {post_count} posts",
            "releaseDate": "",
            "searchKeywords": ["(ranking)"],
            "followerCount": 0,
            "totalWorks": post_count,
            "totalBookmarks": total_score,
            "totalViews": total_score,
            "totalRatings": total_score,
            "bestRank": 0,
            "sampleWorks": sample_works,
            "toolsMedium": [],
            "genreSpecialization": genre_spec,
        }
        results.append(record)

        time.sleep(0.5)
        if (idx + 1) % 10 == 0 or idx == total - 1:
            print(f"  [yandere] Artist [{idx + 1}/{total}]", flush=True)

    print(f"  [yandere] Done, {len(results)} artists collected", flush=True)
    return results
