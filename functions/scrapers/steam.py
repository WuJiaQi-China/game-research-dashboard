"""Steam scraper — search + appdetails API hybrid."""
import re
import time

from bs4 import BeautifulSoup

from scrapers.base import safe_get, SESSION, download_cover


def _steam_appdetails(appid):
    """Fetch a single game's details via Steam Store API."""
    url = f"https://store.steampowered.com/api/appdetails?appids={appid}&l=english"
    r = safe_get(url)
    if not r:
        return None
    try:
        data = r.json()
        info = data.get(str(appid), {})
        if not info.get("success"):
            return None
        d = info["data"]
        desc_html = d.get("detailed_description") or d.get("short_description") or ""
        desc = BeautifulSoup(desc_html, "lxml").get_text(" ", strip=True)[:1500]
        img = d.get("header_image", "")
        tags = [g.get("description", "") for g in (d.get("genres") or [])]
        name = d.get("name", "")
        # Reviews rating
        rating = ""
        try:
            rev_r = SESSION.get(
                f"https://store.steampowered.com/appreviews/{appid}?json=1&language=all&num_per_page=0",
                timeout=10)
            if rev_r.status_code == 200:
                qs = rev_r.json().get("query_summary", {})
                desc_str = qs.get("review_score_desc", "")
                total = qs.get("total_reviews", 0)
                if desc_str:
                    rating = f"{desc_str} ({total} reviews)"
        except Exception:
            pass
        release_date = ""
        rd = d.get("release_date", {})
        if rd and not rd.get("coming_soon"):
            release_date = rd.get("date", "")
        return {"title": name, "description": desc, "image_url": img, "tags": tags, "rating": rating, "release_date": release_date}
    except Exception:
        return None


def scrape_steam_descriptions(keywords, max_per_keyword=50, max_total=300):
    """Search Steam games: search page -> appdetails API."""
    appids = {}  # appid -> {search_keywords: [...], title}
    max_pages = max(1, max_per_keyword // 25 + 1)

    # Phase 1: Collect appids from search pages
    for ti, kw in enumerate(keywords):
        if len(appids) >= max_total:
            break
        fetched_kw = 0
        for pg in range(1, max_pages + 1):
            if fetched_kw >= max_per_keyword:
                break
            start = (pg - 1) * 25
            if kw == "__TOP__":
                params = {"category1": 998, "start": start, "count": 25,
                          "sort_by": "Reviews_DESC"}
            else:
                params = {"term": kw, "category1": 998, "start": start, "count": 25}
            r = safe_get("https://store.steampowered.com/search/", params=params)
            if not r:
                break
            soup = BeautifulSoup(r.text, "lxml")
            rows = soup.select("a.search_result_row")
            if not rows:
                break
            for row in rows:
                if fetched_kw >= max_per_keyword:
                    break
                href = row.get("href", "")
                m = re.search(r'/app/(\d+)', href)
                if m:
                    aid = m.group(1)
                    if aid in appids:
                        if kw not in appids[aid]["search_keywords"]:
                            appids[aid]["search_keywords"].append(kw)
                    else:
                        title_el = row.select_one(".title, span.title")
                        title = title_el.get_text(strip=True) if title_el else ""
                        appids[aid] = {"search_keywords": [kw], "title": title}
                        fetched_kw += 1
            time.sleep(1.0)

    # Phase 2: Fetch details
    results = []
    items = list(appids.items())[:max_total]
    for i, (aid, info) in enumerate(items):
        detail = _steam_appdetails(aid)
        if detail and detail["description"]:
            gid = f"steam_{aid}"
            title = detail["title"] or info["title"]
            cover_url = download_cover(detail["image_url"], gid)
            results.append({
                "id": gid,
                "name": title,
                "title": title,
                "type": "game",
                "source": "steam",
                "description": detail["description"],
                "imageUrl": detail["image_url"],
                "coverStoragePath": "",
                "link": f"https://store.steampowered.com/app/{aid}/",
                "tags": detail["tags"],
                "rating": detail.get("rating", ""),
                "releaseDate": detail.get("release_date", ""),
                "searchKeywords": info["search_keywords"],
            })
        time.sleep(1.5)
    return results
