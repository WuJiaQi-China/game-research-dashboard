"""
ArtStation artist scraper — fetches trending artists from the projects.json endpoint.

Uses the public projects JSON API (no auth required).
Aggregates per-artist stats from trending project listings across up to 10 pages.
"""
import time
from collections import Counter

from .base import safe_get


ARTSTATION_URL = "https://www.artstation.com/projects.json"


def scrape_artstation_artists(
    keywords,
    max_per_keyword=20,
    max_total=100,
    nsfw_filter=True,
) -> list[dict]:
    """Scrape trending ArtStation artists from the public projects JSON API.

    Phase A: Fetch trending project pages (up to 10 pages x 50 = 500 projects).
    Phase B: Aggregate per-artist, build output records.

    Returns list[dict] with camelCase Firestore-ready records.
    """
    print("  [artstation] Starting trending projects scrape...", flush=True)

    # -- Phase A: Fetch project pages --
    # {user_id: {"name", "username", "headline", "avatar_url", "country", "works": [...]}}
    artists: dict = {}
    total_fetched = 0
    max_pages = 10  # 10 pages x 50 = 500 projects

    for page in range(1, max_pages + 1):
        r = safe_get(ARTSTATION_URL, params={"page": page, "per_page": 50})
        if not r:
            print(f"  [artstation] Page {page} fetch failed", flush=True)
            break
        try:
            data = r.json()
        except Exception:
            print(f"  [artstation] Page {page} JSON parse failed", flush=True)
            break

        projects = data.get("data", [])
        if not projects:
            break

        for proj in projects:
            # NSFW filter
            if nsfw_filter and proj.get("adult_content"):
                continue

            user = proj.get("user", {})
            uid = str(user.get("id", ""))
            if not uid:
                continue

            if uid not in artists:
                artists[uid] = {
                    "name": user.get("first_name", "") or user.get("username", ""),
                    "username": user.get("username", ""),
                    "headline": user.get("headline", ""),
                    "avatar_url": user.get("medium_avatar_url", ""),
                    "country": user.get("country", ""),
                    "works": [],
                }

            # Extract cover thumbnail
            cover_info = proj.get("cover", {}) or {}
            cover_url = (
                cover_info.get("small_square_url", "")
                or cover_info.get("micro_square_image_url", "")
            )

            artists[uid]["works"].append({
                "project_id": proj.get("hash_id", proj.get("id", "")),
                "title": proj.get("title", ""),
                "cover_url": cover_url,
                "likes_count": proj.get("likes_count", 0) or 0,
                "views_count": proj.get("views_count", 0) or 0,
                "permalink": proj.get("permalink", ""),
                "tags": proj.get("tag_list", []) or [],
            })

        total_fetched += len(projects)
        print(
            f"  [artstation] Page {page}/{max_pages} ({total_fetched} projects)",
            flush=True,
        )
        time.sleep(0.8)

        if not data.get("data"):
            break

    if not artists:
        print("  [artstation] No data", flush=True)
        return []

    print(
        f"  [artstation] Fetch done: {total_fetched} projects, {len(artists)} artists",
        flush=True,
    )

    # -- Phase B: Per-artist aggregation, build records --
    results: list[dict] = []
    sorted_artists = sorted(
        artists.items(),
        key=lambda x: sum(w["likes_count"] for w in x[1]["works"]),
        reverse=True,
    )[:max_total]

    for idx, (uid, info) in enumerate(sorted_artists):
        works = info["works"]
        name = info["name"]
        username = info["username"]

        # Aggregate tags + stats
        tag_counter: Counter = Counter()
        total_likes = 0
        total_views = 0
        for w in works:
            tags = w.get("tags", [])
            if isinstance(tags, list):
                for t in tags:
                    if t:
                        tag_counter[t] += 1
            total_likes += w.get("likes_count", 0)
            total_views += w.get("views_count", 0)

        style_tags = [t for t, _ in tag_counter.most_common(15)]

        # Fallback: parse headline for role/specialization tags when tag_list is empty
        if not style_tags:
            headline = info.get("headline", "") or ""
            # Split on common separators
            for sep in ["|", "/", ",", " - ", " \u2013 ", " \u00b7 "]:
                headline = headline.replace(sep, "|")
            _hl_parts = [p.strip() for p in headline.split("|") if p.strip()]
            # Filter out short/numeric fragments and generic job-hunt phrases
            _skip = {
                "open for work", "available", "hiring", "freelance", "senior",
                "junior", "lead", "principal", "staff", "intern",
            }
            for part in _hl_parts:
                part_lower = part.lower().strip(".")
                if len(part_lower) > 2 and part_lower not in _skip:
                    style_tags.append(part)

        genre_spec = style_tags[:3]

        # Sample works (top 5 by likes)
        top_works = sorted(works, key=lambda w: w.get("likes_count", 0), reverse=True)[:5]
        sample_works = []
        for w in top_works:
            cover_url = w.get("cover_url", "")
            proj_id = w.get("project_id", idx)
            sample_works.append({
                "illustId": proj_id,
                "title": w.get("title", ""),
                "imageUrl": cover_url,
                "coverStoragePath": "",
                "viewCount": w.get("views_count", 0),
                "ratingCount": w.get("likes_count", 0),
                "tags": w.get("tags", [])[:8] if isinstance(w.get("tags"), list) else [],
            })

        # Avatar URL (no local download needed)
        avatar_url = info.get("avatar_url", "")

        record = {
            "id": f"artstation_user_{uid}",
            "name": name,
            "title": name,
            "type": "artist",
            "source": "artstation.com",
            "description": info.get("headline", ""),
            "imageUrl": avatar_url,
            "coverStoragePath": "",
            "link": f"https://www.artstation.com/{username}",
            "tags": style_tags,
            "rating": f"{total_likes:,} likes",
            "releaseDate": "",
            "searchKeywords": ["(trending)"],
            "followerCount": 0,
            "totalWorks": len(works),
            "totalBookmarks": total_likes,
            "totalViews": total_views,
            "totalRatings": total_likes,
            "bestRank": 0,
            "sampleWorks": sample_works,
            "toolsMedium": [],
            "genreSpecialization": genre_spec,
        }
        results.append(record)

        if (idx + 1) % 10 == 0 or idx == len(sorted_artists) - 1:
            print(
                f"  [artstation] Artist aggregation [{idx + 1}/{len(sorted_artists)}]",
                flush=True,
            )

    print(f"  [artstation] Done, {len(results)} artists collected", flush=True)
    return results
