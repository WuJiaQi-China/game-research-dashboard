"""Otome Obsessed scraper — otome game review blog."""
import time

from bs4 import BeautifulSoup

from scrapers.base import safe_get, download_cover


def scrape_otome_obsessed_descriptions(keywords, max_per_keyword=50, max_total=300):
    """Scrape Otome Obsessed blog reviews (fixed structure, keywords only recorded in searchKeywords)."""
    post_links = {}  # title -> url
    max_pages = 3

    for pg in range(1, max_pages + 1):
        if len(post_links) >= max_total:
            break
        url = "https://otomeobsessed.com/" if pg == 1 else f"https://otomeobsessed.com/page/{pg}/"
        r = safe_get(url)
        if not r:
            break
        soup = BeautifulSoup(r.text, "lxml")
        articles = soup.select("article, .post, .entry")
        for art in articles:
            title_el = art.select_one("h2 a, h1 a, .entry-title a")
            if title_el:
                title = title_el.get_text(strip=True)
                href = title_el.get("href", "")
                if title and href and title not in post_links:
                    post_links[title] = href
        time.sleep(1.0)

    results = []
    limit = min(max_per_keyword, max_total)
    items = list(post_links.items())[:limit]
    for i, (title, url) in enumerate(items):
        r = safe_get(url)
        desc, img_url = "", ""
        if r:
            soup = BeautifulSoup(r.text, "lxml")
            content_el = soup.select_one(".entry-content, .post-content, article .content")
            if content_el:
                desc = content_el.get_text(" ", strip=True)[:1500]
            img_el = (soup.select_one("meta[property='og:image']") or
                      soup.select_one(".entry-content img, .wp-post-image"))
            if img_el:
                img_url = img_el.get("content") or img_el.get("src") or ""
        gid = f"otomeobs_{i}"
        cover_url = download_cover(img_url, gid)
        results.append({
            "id": gid,
            "name": title,
            "title": title,
            "type": "game",
            "source": "otomeobsessed.com",
            "description": desc,
            "imageUrl": img_url,
            "coverStoragePath": "",
            "link": url,
            "tags": [],
            "rating": "",
            "releaseDate": "",
            "searchKeywords": keywords[:],
        })
        time.sleep(0.8)
    return results
