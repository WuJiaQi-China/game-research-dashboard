"""VNDB API scraper — visual novel database."""
import re
import time

from .base import SESSION, download_cover


# Keyword -> VNDB tag_id mapping
KEYWORD_TO_VNDB_TAG = {
    "otome": "g542",
    "female-protagonist": "g31",
    "female protagonist": "g31",
    "reverse-harem": "g2048",
    "reverse harem": "g2048",
    "romance": "g250",
    "shoujo": "g2039",
    "dating-sim": "g1663",
    "dating sim": "g1663",
    "visual-novel": "g2",
    "visual novel": "g2",
    "yuri": "g73",
    "boys-love": "g72",
    "boys love": "g72",
    "bl": "g72",
}


def _clean_bbcode(text):
    if not text:
        return ""
    text = re.sub(r'\[url=[^\]]*\]', '', text)
    text = re.sub(r'\[/url\]', '', text)
    text = re.sub(r'\[spoiler\].*?\[/spoiler\]', '', text, flags=re.DOTALL)
    text = re.sub(r'\[[^\]]+\]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:1500]


def fetch_vndb_descriptions(keywords, max_per_keyword=50, max_total=300):
    """Search VNDB by keywords. Keywords auto-map to tag_ids; unmapped ones use text search.
    Use keywords=['__TOP__'] for top-rated ranking mode."""
    records = {}

    if keywords == ["__TOP__"]:
        kw_pairs = [("top-rated", None)]
    else:
        kw_pairs = []
        for kw in keywords:
            tag_id = KEYWORD_TO_VNDB_TAG.get(kw.lower())
            kw_pairs.append((kw, tag_id))

    for kw, tag_id in kw_pairs:
        if len(records) >= max_total:
            break
        page = 1
        fetched_kw = 0
        while fetched_kw < max_per_keyword and len(records) < max_total:
            batch = min(25, max_per_keyword - fetched_kw)
            if tag_id:
                filters = ["tag", "=", tag_id]
            elif kw == "top-rated":
                filters = None
            else:
                filters = ["search", "=", kw]
            payload = {
                "fields": "id,title,description,released,image.url,image.sexual,image.violence,tags.name,tags.category,length,rating,votecount",
                "sort": "votecount",
                "reverse": True,
                "results": batch,
                "page": page,
            }
            if filters:
                payload["filters"] = filters
            try:
                r = SESSION.post("https://api.vndb.org/kana/vn", json=payload, timeout=15)
                if r.status_code != 200:
                    break
                data = r.json()
                vns = data.get("results", [])
                if not vns:
                    break
                for vn in vns:
                    if fetched_kw >= max_per_keyword:
                        break
                    vid = vn.get("id", "")
                    if vid in records:
                        if kw not in records[vid]["searchKeywords"]:
                            records[vid]["searchKeywords"].append(kw)
                        continue
                    img = vn.get("image") or {}
                    img_url = img.get("url", "") if (img.get("sexual", 0) or 0) < 2 else ""
                    title = vn.get("title", "")
                    game_tags = [t.get("name", "") for t in (vn.get("tags") or []) if t.get("name")]
                    cover_url = download_cover(img_url, vid)
                    records[vid] = {
                        "id": vid,
                        "name": title,
                        "title": title,
                        "type": "game",
                        "source": "vndb.org",
                        "description": _clean_bbcode(vn.get("description") or ""),
                        "imageUrl": img_url,
                        "coverStoragePath": "",
                        "link": f"https://vndb.org/{vid}",
                        "tags": game_tags,
                        "rating": f"{vn.get('rating', 0) / 10:.1f}/10 ({vn.get('votecount', 0)} votes)" if vn.get("rating") else "",
                        "releaseDate": vn.get("released", ""),
                        "searchKeywords": [kw],
                    }
                    fetched_kw += 1
                if not data.get("more"):
                    break
                page += 1
                time.sleep(0.5)
            except Exception as e:
                print(f"  VNDB error: {e}", flush=True)
                break
    return list(records.values())
