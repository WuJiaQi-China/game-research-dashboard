"""Webtoons scraper — webcomic platform."""
import re
import time

import requests
from bs4 import BeautifulSoup

from scrapers.base import safe_get, download_cover


def scrape_webtoons(keywords, max_per_keyword=50, max_total=300):
    """Search Webtoons comics via search page and genre pages. Returns type='comic' records."""
    comics = {}  # title_lower -> record

    for ki, kw in enumerate(keywords):
        if len(comics) >= max_total:
            break
        # Search page
        if kw == "__TOP__":
            search_url = "https://www.webtoons.com/en/top"
        else:
            search_url = f"https://www.webtoons.com/en/search?keyword={requests.utils.quote(kw)}"
        r = safe_get(search_url)
        fetched_kw = 0
        if r:
            soup = BeautifulSoup(r.text, "lxml")
            cards = soup.select("ul.card_lst > li, ul.webtoon_list > li")
            for card in cards:
                if fetched_kw >= max_per_keyword or len(comics) >= max_total:
                    break
                # Title
                title_el = card.select_one("strong.title, .title, .subj .ellipsis, p.subj")
                if not title_el:
                    title_el = card.select_one("a")
                title = title_el.get_text(strip=True) if title_el else ""
                if not title:
                    continue
                key = title.lower()
                if key in comics:
                    if kw not in comics[key]["searchKeywords"]:
                        comics[key]["searchKeywords"].append(kw)
                    continue
                # Link
                link_el = card.select_one("a[href]")
                href = link_el.get("href", "") if link_el else ""
                if href and not href.startswith("http"):
                    href = f"https://www.webtoons.com{href}"
                # Cover
                img_el = card.select_one("img")
                img_url = ""
                if img_el:
                    img_url = img_el.get("src") or img_el.get("data-src") or ""
                # Author
                author_el = card.select_one(".author, .artist")
                author = author_el.get_text(strip=True) if author_el else ""
                # Popularity
                like_el = card.select_one(".view_count, .grade_area .ico_like + em, .grade_num")
                rating = like_el.get_text(strip=True) if like_el else ""
                if rating:
                    rating = f"{rating} likes"
                # title_no for detail page
                title_no = ""
                if link_el:
                    title_no = link_el.get("data-title-no", "")
                    if not title_no:
                        m = re.search(r'title_no=(\d+)', href)
                        if m:
                            title_no = m.group(1)

                gid = f"webtoon_{title_no or len(comics)}"
                cover_url = download_cover(img_url, gid, referer="https://www.webtoons.com/")
                comics[key] = {
                    "id": gid,
                    "name": title,
                    "title": title,
                    "type": "comic",
                    "source": "webtoons.com",
                    "description": f"By {author}" if author else "",
                    "imageUrl": img_url,
                    "coverStoragePath": "",
                    "link": href,
                    "tags": [kw],
                    "rating": rating,
                    "releaseDate": "",
                    "searchKeywords": [kw],
                }
                fetched_kw += 1
            time.sleep(0.8)

        # Also try genre page for common genre words
        genre_map = {
            "romance": "romance", "fantasy": "fantasy", "drama": "drama",
            "comedy": "comedy", "action": "action", "thriller": "thriller",
            "horror": "horror", "sci-fi": "sci-fi", "supernatural": "supernatural",
            "slice of life": "slice-of-life", "mystery": "mystery",
        }
        genre_slug = genre_map.get(kw.lower())
        if genre_slug and fetched_kw < max_per_keyword:
            genre_url = f"https://www.webtoons.com/en/genres/{genre_slug}?sortOrder=MANA"
            r = safe_get(genre_url)
            if r:
                soup = BeautifulSoup(r.text, "lxml")
                cards = soup.select("ul.card_lst > li, ul.webtoon_list > li")
                for card in cards:
                    if fetched_kw >= max_per_keyword or len(comics) >= max_total:
                        break
                    title_el = card.select_one("strong.title, .title, p.subj")
                    title = title_el.get_text(strip=True) if title_el else ""
                    if not title:
                        continue
                    key = title.lower()
                    if key in comics:
                        continue
                    link_el = card.select_one("a[href]")
                    href = link_el.get("href", "") if link_el else ""
                    if href and not href.startswith("http"):
                        href = f"https://www.webtoons.com{href}"
                    img_el = card.select_one("img")
                    img_url = (img_el.get("src") or img_el.get("data-src") or "") if img_el else ""
                    author_el = card.select_one(".author, .artist")
                    author = author_el.get_text(strip=True) if author_el else ""
                    like_el = card.select_one(".view_count, .grade_num")
                    rating = f"{like_el.get_text(strip=True)} likes" if like_el else ""
                    title_no = ""
                    if link_el:
                        m = re.search(r'title_no=(\d+)', link_el.get("href", ""))
                        if m:
                            title_no = m.group(1)

                    gid = f"webtoon_{title_no or len(comics)}"
                    cover_url = download_cover(img_url, gid, referer="https://www.webtoons.com/")
                    comics[key] = {
                        "id": gid,
                        "name": title,
                        "title": title,
                        "type": "comic",
                        "source": "webtoons.com",
                        "description": f"By {author}" if author else "",
                        "imageUrl": img_url,
                        "coverStoragePath": "",
                        "link": href,
                        "tags": [genre_slug],
                        "rating": rating,
                        "releaseDate": "",
                        "searchKeywords": [kw],
                    }
                    fetched_kw += 1
                time.sleep(0.8)

    # Phase 2: Fetch detail page descriptions for comics lacking descriptions
    result_list = list(comics.values())
    for i, rec in enumerate(result_list):
        if rec["description"] and len(rec["description"]) > 20:
            continue
        if not rec["link"]:
            continue
        r = safe_get(rec["link"])
        if r:
            soup = BeautifulSoup(r.text, "lxml")
            desc_el = (soup.select_one("meta[property='og:description']") or
                       soup.select_one(".summary, .detail_body, .detail_lst .summary_area"))
            if desc_el:
                desc = (desc_el.get("content") or desc_el.get_text(" ", strip=True) or "")[:1500]
                if desc:
                    rec["description"] = desc
            # Try to get more tags
            genre_el = soup.select_one("meta[property='article:tag']") or soup.select_one(".genre, .tag")
            if genre_el:
                tag_text = genre_el.get("content") or genre_el.get_text(strip=True) or ""
                if tag_text and tag_text not in rec["tags"]:
                    rec["tags"].append(tag_text)
        time.sleep(0.8)

    return result_list
