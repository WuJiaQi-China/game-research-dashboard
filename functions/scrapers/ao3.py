"""AO3 (Archive of Our Own) scraper — fanfiction archive.

The original implementation uses the ao3_api library which requires special
handling for Cloudflare protection. This Cloud Functions version provides a
simplified HTML scraping fallback, with the ao3_api path attempted first.
"""
import time

from bs4 import BeautifulSoup

from .base import safe_get


def _scrape_ao3_html(keywords, max_per_keyword, max_total):
    """Fallback: basic HTML scraping of AO3 search results.
    Note: AO3 has aggressive Cloudflare protection so this may return
    limited or no results in many environments."""
    records = {}

    for ki, kw in enumerate(keywords):
        if len(records) >= max_total:
            break
        fetched_kw = 0
        page = 1
        max_pages = max(1, max_per_keyword // 20 + 1)

        while fetched_kw < max_per_keyword and page <= max_pages and len(records) < max_total:
            if kw == "__TOP__":
                url = (f"https://archiveofourown.org/works/search"
                       f"?work_search[sort_column]=kudos_count"
                       f"&work_search[sort_direction]=desc&page={page}")
            else:
                url = (f"https://archiveofourown.org/works/search"
                       f"?work_search[query]={kw}"
                       f"&work_search[sort_column]=kudos_count"
                       f"&work_search[sort_direction]=desc&page={page}")
            r = safe_get(url)
            if not r:
                break
            soup = BeautifulSoup(r.text, "lxml")
            works = soup.select("li.work.blurb")
            if not works:
                break

            for w in works:
                if fetched_kw >= max_per_keyword or len(records) >= max_total:
                    break
                # Title and link
                title_el = w.select_one("h4.heading a")
                if not title_el:
                    continue
                title = title_el.get_text(strip=True)
                key = title.lower().strip()
                if not key:
                    continue
                if key in records:
                    if kw not in records[key]["searchKeywords"]:
                        records[key]["searchKeywords"].append(kw)
                    continue
                href = title_el.get("href", "")
                link = f"https://archiveofourown.org{href}" if href else ""
                # Author
                author_el = w.select_one("a[rel='author']")
                author = author_el.get_text(strip=True) if author_el else ""
                # Summary
                summary_el = w.select_one("blockquote.userstuff.summary")
                desc = summary_el.get_text(" ", strip=True)[:1500] if summary_el else ""
                if author and desc:
                    desc = f"By {author}. {desc}"
                elif author:
                    desc = f"By {author}"
                # Tags
                tags = []
                for tag_el in w.select("li.freeforms a.tag, li.fandoms a.tag, li.warnings a.tag, li.relationships a.tag"):
                    tag_text = tag_el.get_text(strip=True)
                    if tag_text:
                        tags.append(tag_text)
                tags = tags[:15]
                # Fandoms
                for fandom_el in w.select("h5.fandoms a.tag"):
                    f_text = fandom_el.get_text(strip=True)
                    if f_text and f_text not in tags:
                        tags.insert(0, f_text)
                # Stats
                rating_parts = []
                kudos_el = w.select_one("dd.kudos a")
                if kudos_el:
                    rating_parts.append(f"{kudos_el.get_text(strip=True)} kudos")
                hits_el = w.select_one("dd.hits")
                if hits_el:
                    rating_parts.append(f"{hits_el.get_text(strip=True)} hits")
                bookmarks_el = w.select_one("dd.bookmarks a")
                if bookmarks_el:
                    rating_parts.append(f"{bookmarks_el.get_text(strip=True)} bookmarks")
                rating = ", ".join(rating_parts)
                # Date
                date_el = w.select_one("p.datetime")
                release_date = date_el.get_text(strip=True) if date_el else ""

                gid = f"ao3_{len(records)}"
                records[key] = {
                    "id": gid,
                    "name": title,
                    "title": title,
                    "type": "novel",
                    "source": "archiveofourown.org",
                    "description": desc,
                    "imageUrl": "",
                    "coverStoragePath": "",
                    "link": link,
                    "tags": tags,
                    "rating": rating,
                    "releaseDate": release_date,
                    "searchKeywords": [kw],
                }
                fetched_kw += 1

            page += 1
            time.sleep(3)  # AO3 strict rate limit

    return list(records.values())


def _scrape_ao3_api(keywords, max_per_keyword, max_total):
    """Use the ao3_api library if available."""
    try:
        import AO3
    except ImportError:
        return None  # Signal to use HTML fallback

    records = {}

    for ki, kw in enumerate(keywords):
        if len(records) >= max_total:
            break
        fetched_kw = 0
        page = 1
        max_pages = max(1, max_per_keyword // 20 + 1)

        while fetched_kw < max_per_keyword and page <= max_pages and len(records) < max_total:
            try:
                if kw == "__TOP__":
                    search = AO3.Search(
                        sort_column="kudos_count", sort_direction="desc", page=page)
                else:
                    search = AO3.Search(
                        any_field=kw,
                        sort_column="kudos_count", sort_direction="desc", page=page)
                search.update()
                works = search.results
            except Exception as e:
                print(f"  AO3 search error [{kw}] page {page}: {e}", flush=True)
                break

            if not works:
                break

            for w in works:
                if fetched_kw >= max_per_keyword or len(records) >= max_total:
                    break
                title = w.title or ""
                key = title.lower().strip()
                if not key:
                    continue
                if key in records:
                    if kw not in records[key]["searchKeywords"]:
                        records[key]["searchKeywords"].append(kw)
                    continue

                link = w.url or ""
                tags = []
                try:
                    tags = list(w.tags or [])[:15]
                except Exception:
                    pass
                desc = ""
                try:
                    desc = str(w.summary or "")[:1500]
                except Exception:
                    pass
                author = ""
                try:
                    authors = w.authors or []
                    if authors:
                        author = str(authors[0]).strip("<>").split("[")[-1].rstrip("]")
                except Exception:
                    pass
                if author and desc:
                    desc = f"By {author}. {desc}"
                elif author:
                    desc = f"By {author}"
                rating_parts = []
                try:
                    if w.kudos:
                        rating_parts.append(f"{w.kudos:,} kudos")
                    if w.hits:
                        rating_parts.append(f"{w.hits:,} hits")
                    if w.bookmarks:
                        rating_parts.append(f"{w.bookmarks:,} bookmarks")
                except Exception:
                    pass
                rating = ", ".join(rating_parts)
                release_date = ""
                try:
                    if w.date_updated:
                        release_date = str(w.date_updated.date())
                except Exception:
                    pass
                try:
                    fandoms = list(w.fandoms or [])[:5]
                    for f in fandoms:
                        if f and f not in tags:
                            tags.insert(0, f)
                except Exception:
                    pass

                gid = f"ao3_{len(records)}"
                records[key] = {
                    "id": gid,
                    "name": title,
                    "title": title,
                    "type": "novel",
                    "source": "archiveofourown.org",
                    "description": desc,
                    "imageUrl": "",
                    "coverStoragePath": "",
                    "link": link,
                    "tags": tags,
                    "rating": rating,
                    "releaseDate": release_date,
                    "searchKeywords": [kw],
                }
                fetched_kw += 1

            page += 1
            time.sleep(3)  # AO3 strict rate limit

    return list(records.values())


def scrape_ao3(keywords, max_per_keyword=50, max_total=300):
    """Search AO3 fanfiction. Tries ao3_api library first, falls back to HTML scraping."""
    # Try ao3_api library first
    result = _scrape_ao3_api(keywords, max_per_keyword, max_total)
    if result is not None:
        return result

    # Fallback to HTML scraping
    print("  ao3_api not installed, falling back to HTML scraping", flush=True)
    return _scrape_ao3_html(keywords, max_per_keyword, max_total)
