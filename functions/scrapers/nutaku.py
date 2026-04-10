"""Nutaku scraper — adult games platform."""
import time

from bs4 import BeautifulSoup

from scrapers.base import safe_get, download_cover


def scrape_nutaku_descriptions(keywords, max_per_keyword=40, max_total=300):
    """Search Nutaku games by keyword tags: tag listing page -> game detail pages."""
    game_links = {}  # title -> {url, search_keywords: [...]}

    for ti, kw in enumerate(keywords):
        if len(game_links) >= max_total:
            break
        if kw == "__TOP__":
            url = "https://www.nutaku.net/games/"
        else:
            tag_slug = kw.lower().replace(" ", "-")
            url = f"https://www.nutaku.net/games/?tag={tag_slug}"
        r = safe_get(url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")
        cards = soup.select(".game-card, .game_item, article, .card")
        fetched_kw = 0
        for card in cards:
            if fetched_kw >= max_per_keyword:
                break
            link_el = card.select_one("a[href]")
            title_el = card.select_one("h2, h3, .title, .game-title")
            if link_el and title_el:
                title = title_el.get_text(strip=True)
                href = link_el.get("href", "")
                if href and title:
                    if not href.startswith("http"):
                        href = f"https://www.nutaku.net{href}"
                    if title in game_links:
                        if kw not in game_links[title]["search_keywords"]:
                            game_links[title]["search_keywords"].append(kw)
                    else:
                        game_links[title] = {"url": href, "search_keywords": [kw]}
                        fetched_kw += 1
        time.sleep(1.5)

    results = []
    items = list(game_links.items())[:max_total]
    for i, (title, info) in enumerate(items):
        r = safe_get(info["url"])
        desc, img_url = "", ""
        if r:
            soup = BeautifulSoup(r.text, "lxml")
            desc_el = (soup.select_one("meta[property='og:description']") or
                       soup.select_one(".game-description, .description, .content p"))
            if desc_el:
                desc = (desc_el.get("content") or desc_el.get_text(" ", strip=True) or "")[:1500]
            img_el = (soup.select_one("meta[property='og:image']") or
                      soup.select_one(".game-cover img, .cover img"))
            if img_el:
                img_url = img_el.get("content") or img_el.get("src") or ""
        gid = f"nutaku_{i}"
        cover_url = download_cover(img_url, gid)
        results.append({
            "id": gid,
            "name": title,
            "title": title,
            "type": "game",
            "source": "nutaku.net",
            "description": desc,
            "imageUrl": img_url,
            "coverStoragePath": "",
            "link": info["url"],
            "tags": [],
            "rating": "",
            "releaseDate": "",
            "searchKeywords": info["search_keywords"],
        })
        time.sleep(1.0)
    return results
