"""erogames.to scraper."""
import time

import requests
from bs4 import BeautifulSoup

from .base import safe_get, download_cover


def scrape_erogames_descriptions(keywords, max_per_keyword=15, max_total=300):
    """Search erogames.to games by keywords."""
    results = []
    seen_urls = set()
    for qi, kw in enumerate(keywords):
        if len(results) >= max_total:
            break
        if kw == "__TOP__":
            url = "https://erogames.to/games"
        else:
            url = f"https://erogames.to/search/{requests.utils.quote(kw)}"
        r = safe_get(url)
        if not r:
            continue
        soup = BeautifulSoup(r.text, "lxml")
        # erogames uses /game/ (singular) paths
        game_links = soup.select("a[href*='/game/']")
        if not game_links:
            # Fallback: extract from .game-card
            for card in soup.select(".game-card"):
                a = card.select_one("a[href]")
                if a and a.get("href"):
                    game_links.append(a)
        fetched_kw = 0
        for a in game_links:
            if fetched_kw >= max_per_keyword or len(results) >= max_total:
                break
            href = a.get("href", "")
            if not href or href in seen_urls:
                continue
            seen_urls.add(href)
            full_url = f"https://erogames.to{href}" if href.startswith("/") else href
            game_r = safe_get(full_url)
            if not game_r:
                continue
            game_soup = BeautifulSoup(game_r.text, "lxml")
            title_el = game_soup.select_one("h1, h2, .game-title")
            desc_el = (game_soup.select_one("meta[property='og:description']") or
                       game_soup.select_one("meta[name='description']") or
                       game_soup.select_one(".game-description, .description, .content p, article p"))
            img_el = (game_soup.select_one("meta[property='og:image']") or
                      game_soup.select_one(".game-cover img, .cover img"))
            title = title_el.get_text(strip=True) if title_el else "Unknown"
            if desc_el:
                desc = (desc_el.get("content") or desc_el.get_text(" ", strip=True) or "")[:1500]
            else:
                desc = ""
            img_url = (img_el.get("content") or img_el.get("src") or "") if img_el else ""
            # Tags: only <a> tags pointing to /tags/
            game_tags = [t.get_text(strip=True) for t in game_soup.select("a.tag[href*='/tags/']")
                         if t.get_text(strip=True)]
            # Rating (percentage format)
            rating = ""
            rating_el = game_soup.select_one("[class*='rating'], [class*='score']")
            if rating_el:
                rating = rating_el.get_text(strip=True)
            if title and title != "Unknown":
                gid = f"eroge_{len(results)}"
                cover_url = download_cover(img_url, gid)
                results.append({
                    "id": gid,
                    "name": title,
                    "title": title,
                    "type": "game",
                    "source": "erogames.to",
                    "description": desc,
                    "imageUrl": img_url,
                    "coverStoragePath": "",
                    "link": full_url,
                    "tags": game_tags,
                    "rating": rating,
                    "releaseDate": "",
                    "searchKeywords": [kw],
                })
                fetched_kw += 1
            time.sleep(0.8)
        time.sleep(1.0)
    return results
