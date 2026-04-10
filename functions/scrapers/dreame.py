"""Dreame scraper — novel/romance platform."""
import re
import time

from bs4 import BeautifulSoup

from .base import safe_get, download_cover


DREAME_GENRES = [
    "romance", "werewolf", "fantasy", "billionaire", "young-adult",
    "urban", "mystery-thriller", "historical-fiction",
]


def scrape_dreame(keywords, max_per_keyword=50, max_total=300):
    """Scrape Dreame novels via ranking pages + detail page meta. Returns type='novel' records."""
    novels = {}  # title_lower -> record

    # Phase 1: Collect story links from ranking pages
    genres_to_try = set()
    if keywords == ["__TOP__"]:
        for g in DREAME_GENRES:
            genres_to_try.add(g)
    else:
        for kw in keywords:
            slug = kw.lower().replace(" ", "-")
            genres_to_try.add(slug)
        for g in DREAME_GENRES[:4]:
            genres_to_try.add(g)

    story_links = {}  # path -> {title, kw, rank, genre}
    global_rankings = ["6112", "6113", "6114", "6115", "6116", "6117"]
    max_pages_per_genre = max(1, max_per_keyword // 10 + 1)

    for gi, genre in enumerate(list(genres_to_try)):
        if len(story_links) >= max_total:
            break
        fetched_in_genre = 0
        for page in range(1, max_pages_per_genre + 1):
            if fetched_in_genre >= max_per_keyword:
                break
            url = f"https://www.dreame.com/ranking/{genre}?page={page}"
            r = safe_get(url)
            if not r or r.status_code != 200:
                break
            soup = BeautifulSoup(r.text, "lxml")
            page_new = 0
            for a in soup.select("a[href*='/story/']"):
                if fetched_in_genre >= max_per_keyword:
                    break
                href = a.get("href", "")
                title = a.get_text(strip=True)
                if not title or len(title) < 3 or title in ("Start Reading", "Read Now"):
                    continue
                if "/chapter-" in href:
                    continue
                if href not in story_links:
                    fetched_in_genre += 1
                    story_links[href] = {
                        "title": title, "genre": genre,
                        "search_keywords": [genre],
                        "rank": fetched_in_genre,
                        "rank_genre": genre,
                    }
                    page_new += 1
            if page_new == 0:
                break
            time.sleep(0.8)

    # Supplement from global rankings if not yet at max_total
    if len(story_links) < max_total:
        for ri, rid in enumerate(global_rankings):
            if len(story_links) >= max_total:
                break
            for page in range(1, 4):
                url = f"https://www.dreame.com/ranking/{rid}.html?page={page}"
                r = safe_get(url)
                if not r or r.status_code != 200:
                    break
                soup = BeautifulSoup(r.text, "lxml")
                page_new = 0
                for a in soup.select("a[href*='/story/']"):
                    href = a.get("href", "")
                    title = a.get_text(strip=True)
                    if not title or len(title) < 3 or title in ("Start Reading", "Read Now"):
                        continue
                    if "/chapter-" in href:
                        continue
                    if href not in story_links:
                        story_links[href] = {
                            "title": title, "genre": "trending",
                            "search_keywords": ["__TOP__"],
                            "rank": len(story_links) + 1,
                            "rank_genre": "Global",
                        }
                        page_new += 1
                if page_new == 0:
                    break
                time.sleep(0.8)
        time.sleep(1.0)

    # Phase 2: Fetch detail page meta
    items = list(story_links.items())[:max_total]
    for i, (path, info) in enumerate(items):
        full_url = f"https://www.dreame.com{path}" if path.startswith("/") else path
        title = info["title"]
        key = title.lower()
        if key in novels:
            continue
        r = safe_get(full_url)
        desc, img_url = "", ""
        follows_str, reads_str = "", ""
        if r and r.status_code == 200:
            soup = BeautifulSoup(r.text, "lxml")
            og_desc = soup.select_one("meta[property='og:description']")
            og_img = soup.select_one("meta[property='og:image']")
            og_title = soup.select_one("meta[property='og:title']")
            if og_desc:
                desc = (og_desc.get("content") or "")[:1500]
            if og_img:
                img_url = og_img.get("content") or ""
            if og_title:
                title = og_title.get("content") or title
                key = title.lower()
                if key in novels:
                    continue
            # Extract follow and read data
            data_div = soup.select_one("[class*='novel-data']")
            if data_div:
                text = data_div.get_text(" ", strip=True)
                m_follow = re.search(r'([\d.]+[KMB]?)\s*FOLLOW', text, re.I)
                m_read = re.search(r'([\d.]+[KMB]?)\s*READ', text, re.I)
                if m_follow:
                    follows_str = m_follow.group(1)
                if m_read:
                    reads_str = m_read.group(1)

        # Build rating
        rating_parts = []
        if reads_str:
            rating_parts.append(f"{reads_str} reads")
        if follows_str:
            rating_parts.append(f"{follows_str} follows")
        rank = info.get("rank")
        if rank:
            rating_parts.append(f"#{rank} in {info.get('rank_genre', info['genre']).title()}")
        rating = ", ".join(rating_parts)

        gid = f"dreame_{i}"
        cover_url = download_cover(img_url, gid)
        novels[key] = {
            "id": gid,
            "name": title,
            "title": title,
            "type": "novel",
            "source": "dreame.com",
            "description": desc,
            "imageUrl": img_url,
            "coverStoragePath": "",
            "link": full_url,
            "tags": [info["genre"]],
            "rating": rating,
            "releaseDate": "",
            "searchKeywords": info["search_keywords"],
        }
        time.sleep(0.8)

    return list(novels.values())
