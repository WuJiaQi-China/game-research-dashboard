"""DLsite scraper — doujin/indie game marketplace."""
import time

from bs4 import BeautifulSoup

from .base import safe_get, download_cover


DEFAULT_DLSITE_CATEGORIES = [
    ("women-EN", "https://www.dlsite.com/ecchi-eng/fsr/=/language/ENG/sex_category%5B0%5D/female/order%5B0%5D/rate_total_average_point/per_page/30"),
    ("otome-JP", "https://www.dlsite.com/girls/fsr/=/language/JPN/order%5B0%5D/rate_total_average_point/per_page/30"),
]


def _dlsite_game_detail(url):
    """Extract description, cover, tags, and rating from a DLsite work detail page."""
    r = safe_get(url)
    if not r:
        return {"desc": "", "img_url": "", "tags": [], "rating": "", "release_date": ""}
    soup = BeautifulSoup(r.text, "lxml")
    # Description
    desc_el = (soup.select_one(".work_parts_container") or
               soup.select_one("#work_outline") or
               soup.select_one("meta[property='og:description']"))
    if desc_el:
        desc = desc_el.get("content") if desc_el.name == "meta" else desc_el.get_text(" ", strip=True)
    else:
        desc = ""
    desc = desc[:1500] if desc else ""
    # Cover image
    img_el = (soup.select_one(".slider_item img") or
              soup.select_one("meta[property='og:image']") or
              soup.select_one("#work_header img"))
    img_url = ""
    if img_el:
        img_url = img_el.get("content") or img_el.get("src") or ""
    # Tags (genre)
    tags = [a.get_text(strip=True) for a in soup.select(".work_genre a, .main_genre a")
            if a.get_text(strip=True)]
    # Rating / points
    rating = ""
    point_el = soup.select_one(".point .average_count, .point, [class*='point']")
    if point_el:
        text = point_el.get_text(strip=True)
        if text and text != "Points-pt":
            rating = text
    # Sales count
    dl_el = soup.select_one(".work_dl_count, .dl_count")
    if dl_el:
        dl_text = dl_el.get_text(strip=True)
        if dl_text and rating:
            rating = f"{rating} ({dl_text})"
        elif dl_text:
            rating = dl_text
    # Release date
    release_date = ""
    for th in soup.select("th"):
        if "販売日" in th.get_text() or "Release date" in th.get_text():
            td = th.find_next_sibling("td")
            if td:
                release_date = td.get_text(strip=True)
                break
    return {"desc": desc, "img_url": img_url, "tags": tags, "rating": rating, "release_date": release_date}


def scrape_dlsite_descriptions(keywords, max_per_keyword=50, max_total=300,
                               dlsite_categories=None, language_filter="all"):
    """Scrape DLsite works using fixed category URLs.
    max_per_keyword is used as per-category limit here.
    language_filter can filter categories (EN/JP)."""
    cats = dlsite_categories or DEFAULT_DLSITE_CATEGORIES
    # Filter categories by language
    if language_filter == "en":
        cats = [(l, u) for l, u in cats if "-EN" in l or "ENG" in u]
    elif language_filter == "ja":
        cats = [(l, u) for l, u in cats if "-JP" in l or "JPN" in u]
    if not cats:
        print("  DLsite: no matching language categories, skipping", flush=True)
        return []
    game_links = {}  # title -> {url, category_label}
    total_limit = min(max_per_keyword, max_total)
    max_pages = max(1, total_limit // 30 + 1)

    for ci, (label, base_url) in enumerate(cats):
        if len(game_links) >= total_limit:
            break
        for pg in range(1, max_pages + 1):
            if len(game_links) >= total_limit:
                break
            url = base_url if pg == 1 else f"{base_url}/page/{pg}"
            r = safe_get(url)
            if not r:
                break
            soup = BeautifulSoup(r.text, "lxml")
            work_links = soup.select(".work_name a")
            if not work_links:
                work_links = soup.select(".search_result_img_box_inner a[href*='/work/']")
            if not work_links:
                break
            for wl in work_links:
                if len(game_links) >= total_limit:
                    break
                title = wl.get_text(strip=True)
                href = wl.get("href", "")
                if href and title and title not in game_links:
                    if not href.startswith("http"):
                        href = f"https://www.dlsite.com{href}"
                    game_links[title] = {"url": href, "category": label}
            time.sleep(1.5)

    results = []
    items = list(game_links.items())[:total_limit]
    for i, (title, info) in enumerate(items):
        detail = _dlsite_game_detail(info["url"])
        gid = f"dlsite_{i}"
        cover_url = download_cover(detail["img_url"], gid)
        results.append({
            "id": gid,
            "name": title,
            "title": title,
            "type": "game",
            "source": "dlsite.com",
            "description": detail["desc"],
            "imageUrl": detail["img_url"],
            "coverStoragePath": "",
            "link": info["url"],
            "tags": detail["tags"],
            "rating": detail["rating"],
            "releaseDate": detail.get("release_date", ""),
            "searchKeywords": keywords[:],
        })
        time.sleep(1.0)
    return results
