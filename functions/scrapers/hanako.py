"""Hanako Games scraper — visual novel developer site."""
import re
import time

from bs4 import BeautifulSoup

from scrapers.base import safe_get, download_cover


def _scrape_itchio_game_detail(url):
    """Scrape a single itch.io game detail page for tags and rating (helper for Hanako cross-ref)."""
    r = safe_get(url)
    if not r:
        return {"desc": "", "img_url": "", "tags": [], "rating": ""}
    soup = BeautifulSoup(r.text, "lxml")
    desc_el = (soup.select_one(".formatted_description") or
               soup.select_one(".game_description") or
               soup.select_one("div.content"))
    desc = desc_el.get_text(" ", strip=True)[:1500] if desc_el else ""
    img_el = (soup.select_one("meta[property='og:image']") or
              soup.select_one(".screenshot img") or
              soup.select_one(".cover_image img"))
    img_url = ""
    if img_el:
        img_url = img_el.get("content") or img_el.get("src") or ""
    tags = []
    info_panel = soup.select_one(".game_info_panel_widget")
    if info_panel:
        for a in info_panel.select("a"):
            href = a.get("href", "")
            text = a.get_text(strip=True)
            if text and ("/tag-" in href or "/genre-" in href):
                tags.append(text)
    rating = ""
    if info_panel:
        for row in info_panel.select("tr"):
            cells = row.select("td")
            if len(cells) >= 2:
                label = cells[0].get_text(strip=True)
                if "Rating" in label:
                    rating = cells[1].get_text(" ", strip=True)
    return {"desc": desc, "img_url": img_url, "tags": tags, "rating": rating}


def scrape_hanako_descriptions(keywords, max_per_keyword=30, max_total=300):
    """Scrape Hanako Games from their homepage, cross-referencing itch.io for tags/ratings."""
    r = safe_get("https://www.hanakogames.com/")
    if not r:
        return []
    soup = BeautifulSoup(r.text, "lxml")
    game_links = {}
    for a in soup.select("a[href]"):
        title = a.get_text(strip=True)
        href = a.get("href", "")
        if (len(title) > 3 and href and title not in game_links
                and ".shtml" in href and href != "/" and "support" not in href.lower()):
            if not href.startswith("http"):
                href = f"https://www.hanakogames.com/{href.lstrip('/')}"
            game_links[title] = href

    limit = min(max_per_keyword, max_total)
    items = list(game_links.items())[:limit]

    results = []
    for i, (title, url) in enumerate(items):
        r = safe_get(url)
        desc, img_url, tags, rating = "", "", [], ""
        if r:
            soup = BeautifulSoup(r.text, "lxml")
            # Description
            desc_el = soup.select_one("meta[property='og:description']") or soup.select_one("meta[name='description']")
            if desc_el and desc_el.get("content", ""):
                desc = desc_el["content"][:1500]
            else:
                paragraphs = [p.get_text(" ", strip=True) for p in soup.select("p")
                              if len(p.get_text(strip=True)) > 30]
                desc = " ".join(paragraphs)[:1500]
            # Image
            img_el = (soup.select_one("meta[property='og:image']") or
                      soup.select_one("img[src*='screenshot'], img[src*='game'], img[src*='cover']"))
            if img_el:
                img_url = img_el.get("content") or img_el.get("src") or ""
                if img_url and not img_url.startswith("http"):
                    img_url = f"https://www.hanakogames.com/{img_url.lstrip('/')}"

        # Cross-reference itch.io for tags and rating
        slug = title.lower().replace(" ", "-").replace("'", "").replace(":", "")
        slug = re.sub(r'[^a-z0-9\-]', '', slug)
        itch_url = f"https://hanakogames.itch.io/{slug}"
        itch_detail = _scrape_itchio_game_detail(itch_url)
        if itch_detail["tags"]:
            tags = itch_detail["tags"]
            rating = itch_detail["rating"]
            if not desc and itch_detail["desc"]:
                desc = itch_detail["desc"]
            if not img_url and itch_detail["img_url"]:
                img_url = itch_detail["img_url"]

        gid = f"hanako_{i}"
        cover_url = download_cover(img_url, gid)
        results.append({
            "id": gid,
            "name": title,
            "title": title,
            "type": "game",
            "source": "hanakogames.com",
            "description": desc,
            "imageUrl": img_url,
            "coverStoragePath": "",
            "link": url,
            "tags": tags,
            "rating": rating,
            "releaseDate": "",
            "searchKeywords": keywords[:],
        })
        time.sleep(0.8)
    return results
