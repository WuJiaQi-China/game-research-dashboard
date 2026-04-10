"""itch.io scraper — indie games platform."""
import time

from bs4 import BeautifulSoup

from .base import safe_get, download_cover


def _scrape_itchio_game(url):
    """Scrape a single itch.io game detail page: description, cover, tags, rating."""
    r = safe_get(url)
    if not r:
        return {"desc": "", "img_url": "", "tags": [], "rating": "", "release_date": ""}
    soup = BeautifulSoup(r.text, "lxml")
    # Description
    desc_el = (soup.select_one(".formatted_description") or
               soup.select_one(".game_description") or
               soup.select_one("div.content"))
    desc = desc_el.get_text(" ", strip=True)[:1500] if desc_el else ""
    # Cover image
    img_el = (soup.select_one("meta[property='og:image']") or
              soup.select_one(".screenshot img") or
              soup.select_one(".cover_image img"))
    img_url = ""
    if img_el:
        img_url = img_el.get("content") or img_el.get("src") or ""
    # Tags from info panel
    tags = []
    info_panel = soup.select_one(".game_info_panel_widget")
    if info_panel:
        for a in info_panel.select("a"):
            href = a.get("href", "")
            text = a.get_text(strip=True)
            if text and ("/tag-" in href or "/genre-" in href):
                tags.append(text)
    # Rating and release date from info panel rows
    rating = ""
    release_date = ""
    if info_panel:
        for row in info_panel.select("tr"):
            cells = row.select("td")
            if len(cells) >= 2:
                label = cells[0].get_text(strip=True)
                if "Rating" in label:
                    rating = cells[1].get_text(" ", strip=True)
                elif "Release date" in label or "Published" in label:
                    date_el = cells[1].select_one("abbr[title]")
                    if date_el:
                        release_date = date_el.get("title", "").split("@")[0].strip()
                    else:
                        release_date = cells[1].get_text(strip=True)
    return {"desc": desc, "img_url": img_url, "tags": tags, "rating": rating, "release_date": release_date}


def scrape_itchio_descriptions(keywords, max_per_keyword=50, max_total=300):
    """Search itch.io games by keyword tags."""
    game_links = {}  # title -> {url, search_keywords: [kw, ...]}
    max_pages = max(1, max_per_keyword // 30 + 1)

    for ti, kw in enumerate(keywords):
        if len(game_links) >= max_total:
            break
        if kw == "__TOP__":
            base_url = "https://itch.io/games/top-rated"
        else:
            tag_slug = kw.lower().replace(" ", "-")
            base_url = f"https://itch.io/games/tag-{tag_slug}"
        fetched_kw = 0
        for pg in range(1, max_pages + 1):
            if fetched_kw >= max_per_keyword:
                break
            url = base_url if pg == 1 else f"{base_url}?page={pg}"
            r = safe_get(url)
            if not r:
                break
            soup = BeautifulSoup(r.text, "lxml")
            cells = soup.select(".game_cell")
            if not cells:
                break
            for cell in cells:
                if fetched_kw >= max_per_keyword:
                    break
                title_el = cell.select_one(".game_title")
                link_el = cell.select_one("a.game_link, a.thumb_link, a")
                if title_el and link_el:
                    title = title_el.get_text(strip=True)
                    href = link_el.get("href", "")
                    if href and "itch.io" in href:
                        if title in game_links:
                            if kw not in game_links[title]["search_keywords"]:
                                game_links[title]["search_keywords"].append(kw)
                        else:
                            game_links[title] = {"url": href, "search_keywords": [kw]}
                            fetched_kw += 1
            time.sleep(0.8)

    # Fetch individual game pages
    results = []
    items = list(game_links.items())[:max_total]
    for i, (title, info) in enumerate(items):
        detail = _scrape_itchio_game(info["url"])
        gid = f"itchio_{i}"
        cover_url = download_cover(detail["img_url"], gid)
        results.append({
            "id": gid,
            "name": title,
            "title": title,
            "type": "game",
            "source": "itch.io",
            "description": detail["desc"],
            "imageUrl": detail["img_url"],
            "coverStoragePath": "",
            "link": info["url"],
            "tags": detail["tags"],
            "rating": detail["rating"],
            "releaseDate": detail.get("release_date", ""),
            "searchKeywords": info["search_keywords"],
        })
        time.sleep(0.6)
    return results
