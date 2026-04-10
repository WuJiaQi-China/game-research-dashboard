"""Wattpad scraper — novel/story platform via API."""
import time

import requests

from .base import safe_get, download_cover


def scrape_wattpad(keywords, max_per_keyword=50, max_total=300):
    """Search novels via the Wattpad API. Returns type='novel' records."""
    records = {}  # title_lower -> record

    for ki, kw in enumerate(keywords):
        if len(records) >= max_total:
            break
        offset = 0
        fetched_kw = 0
        while fetched_kw < max_per_keyword and len(records) < max_total:
            if kw == "__TOP__":
                api_url = (f"https://www.wattpad.com/api/v3/stories"
                           f"?limit=20&offset={offset}&mature=0&filter=hot")
            else:
                api_url = (f"https://www.wattpad.com/api/v3/stories"
                           f"?query={requests.utils.quote(kw)}&limit=20&offset={offset}")
            r = safe_get(api_url)
            if not r:
                break
            try:
                data = r.json()
            except Exception:
                break
            stories = data.get("stories") or data.get("results") or []
            if not stories:
                if isinstance(data, list):
                    stories = data
                else:
                    break
            for story in stories:
                if fetched_kw >= max_per_keyword or len(records) >= max_total:
                    break
                sid = str(story.get("id", ""))
                title = story.get("title", "").strip()
                if not title:
                    continue
                key = title.lower()
                if key in records:
                    if kw not in records[key]["searchKeywords"]:
                        records[key]["searchKeywords"].append(kw)
                    continue
                desc = (story.get("description") or "").strip()[:1500]
                cover_img = story.get("cover", "")
                story_url = story.get("url", f"https://www.wattpad.com/story/{sid}")
                tags = story.get("tags") or []
                # Rating: use read count and vote count
                reads = story.get("readCount", 0)
                votes = story.get("voteCount", 0)
                parts = story.get("numParts", 0)
                completed = story.get("completed", False)
                rating_parts = []
                if reads:
                    if reads >= 1_000_000:
                        rating_parts.append(f"{reads / 1_000_000:.1f}M reads")
                    elif reads >= 1_000:
                        rating_parts.append(f"{reads / 1_000:.1f}K reads")
                    else:
                        rating_parts.append(f"{reads} reads")
                if votes:
                    rating_parts.append(f"{votes} votes")
                if parts:
                    rating_parts.append(f"{parts} parts")
                if completed:
                    rating_parts.append("Complete")
                rating = ", ".join(rating_parts)

                gid = f"wattpad_{sid}"
                cover_url = download_cover(cover_img, gid)
                records[key] = {
                    "id": gid,
                    "name": title,
                    "title": title,
                    "type": "novel",
                    "source": "wattpad.com",
                    "description": desc,
                    "imageUrl": cover_img,
                    "coverStoragePath": "",
                    "link": story_url,
                    "tags": tags,
                    "rating": rating,
                    "releaseDate": (story.get("createDate") or "")[:10],
                    "searchKeywords": [kw],
                }
                fetched_kw += 1
            offset += 20
            if not data.get("nextUrl") and len(stories) < 20:
                break
            time.sleep(0.5)

    return list(records.values())
