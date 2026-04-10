"""JJWXC (Jin Jiang Literature City) scraper — Chinese web novel platform."""
import re
import time

import requests
from bs4 import BeautifulSoup

from .base import safe_get, download_cover


JJWXC_SEARCH_TAGS = {
    "otome": "乙女",
    "romance": "言情",
    "female protagonist": "女主",
    "female-protagonist": "女主",
    "villainess": "恶毒女配",
    "isekai": "穿越",
    "reincarnation": "重生",
    "reverse-harem": "逆后宫",
    "reverse harem": "逆后宫",
    "bl": "耽美",
    "boys-love": "耽美",
    "boys love": "耽美",
    "yuri": "百合",
    "fantasy": "奇幻",
    "historical": "古代",
    "modern": "现代",
    "xuanhuan": "玄幻",
    "cultivation": "修仙",
    "系统": "系统",
    "宫斗": "宫斗",
    "种田": "种田",
}


def scrape_jjwxc(keywords, max_per_keyword=50, max_total=300):
    """Search JJWXC novels via their book database. Returns type='novel' records."""
    novels = {}  # title -> record

    if keywords == ["__TOP__"]:
        keywords = ["言情"]  # Default to popular romance

    for ki, kw in enumerate(keywords):
        if len(novels) >= max_total:
            break
        # Map keyword to Chinese
        search_term = JJWXC_SEARCH_TAGS.get(kw.lower(), kw)
        fetched_kw = 0
        page = 1
        max_pages = max(1, max_per_keyword // 100 + 1)
        while fetched_kw < max_per_keyword and page <= max_pages and len(novels) < max_total:
            # JJWXC uses GBK-encoded URL parameters
            try:
                encoded_kw = search_term.encode("gb18030")
                from urllib.parse import quote
                kw_param = quote(encoded_kw)
            except Exception:
                kw_param = requests.utils.quote(search_term)
            url = (f"https://www.jjwxc.net/bookbase.php?"
                   f"searchkeywords={kw_param}&page={page}"
                   f"&sortType=3&isFinish=0")
            r = safe_get(url)
            if not r:
                break
            r.encoding = "gb18030"
            soup = BeautifulSoup(r.text, "lxml")
            rows = soup.select("tr")
            if len(rows) < 2:
                break
            new_in_page = 0
            for row in rows[1:]:
                if fetched_kw >= max_per_keyword or len(novels) >= max_total:
                    break
                cells = row.select("td")
                if len(cells) < 5:
                    continue
                # Columns: Author | Title | Type/Tags | Status | Score | Bookmarks
                author_el = cells[0].select_one("a")
                title_el = cells[1].select_one("a")
                if not title_el:
                    continue
                title = title_el.get_text(strip=True)
                if not title or title in novels:
                    continue
                author = author_el.get_text(strip=True) if author_el else ""
                # Tags
                tag_text = cells[2].get_text(strip=True) if len(cells) > 2 else ""
                tags = [t.strip() for t in tag_text.replace("原创-", "").split("-") if t.strip()]
                # Status
                status = cells[3].get_text(strip=True) if len(cells) > 3 else ""
                # Score
                score = cells[4].get_text(strip=True) if len(cells) > 4 else ""
                # Bookmarks
                bookmarks = cells[5].get_text(strip=True) if len(cells) > 5 else ""
                # Rating
                rating_parts = []
                if score and score != "0":
                    rating_parts.append(f"积分 {score}")
                if bookmarks and bookmarks != "0":
                    rating_parts.append(f"收藏 {bookmarks}")
                if status:
                    rating_parts.append(status)
                rating = ", ".join(rating_parts)

                # Link
                href = title_el.get("href", "")
                novel_id = ""
                m = re.search(r'novelid=(\d+)', href)
                if m:
                    novel_id = m.group(1)
                link = f"https://www.jjwxc.net/onebook.php?novelid={novel_id}" if novel_id else ""

                gid = f"jjwxc_{novel_id or len(novels)}"
                novels[title] = {
                    "id": gid,
                    "name": title,
                    "title": title,
                    "type": "novel",
                    "source": "jjwxc.net",
                    "description": f"作者: {author}" if author else "",
                    "imageUrl": "",
                    "coverStoragePath": "",
                    "link": link,
                    "tags": tags + [search_term],
                    "rating": rating,
                    "releaseDate": "",
                    "searchKeywords": [kw],
                }
                fetched_kw += 1
                new_in_page += 1
            page += 1
            if new_in_page == 0:
                break
            time.sleep(1.5)

    # Phase 2: Fetch detail page descriptions for items with sparse descriptions
    items_needing_desc = [(k, v) for k, v in novels.items()
                          if v["link"] and len(v["description"]) < 50][:min(max_total, 100)]
    for i, (title, rec) in enumerate(items_needing_desc):
        r = safe_get(rec["link"])
        if r:
            r.encoding = "gb18030"
            soup = BeautifulSoup(r.text, "lxml")
            desc_el = soup.select_one("#novelintro, div[id=novelintro]")
            if desc_el:
                rec["description"] = desc_el.get_text(" ", strip=True)[:1500]
            # Cover
            img_el = soup.select_one("img[src*=novelimage]")
            if img_el:
                img_url = img_el.get("src", "")
                if img_url:
                    rec["imageUrl"] = img_url
                    rec["coverStoragePath"] = ""
            # More detailed tags
            for a in soup.select("a.bluetext[href*=bookbase]"):
                t = a.get_text(strip=True)
                if t and t not in rec["tags"]:
                    rec["tags"].append(t)
        time.sleep(1.0)

    return list(novels.values())
