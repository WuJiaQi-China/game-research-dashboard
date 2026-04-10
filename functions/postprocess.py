"""
Post-processing: deduplication, language filtering, DLC filtering, platform limits.
Ported from pipeline_descriptions.py.
"""
import re


def detect_desc_language(text: str) -> str:
    """Detect the primary language of description text."""
    if not text:
        return "unknown"
    cjk_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    ja_chars = sum(1 for c in text if '\u3040' <= c <= '\u30ff' or '\u31f0' <= c <= '\u31ff')
    ascii_chars = sum(1 for c in text if ord(c) < 128)
    total = max(len(text), 1)
    if ja_chars / total > 0.05:
        return "ja"
    if cjk_chars / total > 0.1:
        return "zh"
    if ascii_chars / total > 0.85:
        return "en"
    return "other"


def is_dlc_title(title: str, dlc_keywords: list) -> bool:
    """Check if a title matches DLC/expansion keywords."""
    title_lower = title.lower()
    for kw in dlc_keywords:
        if kw.lower() in title_lower:
            return True
    return False


DEFAULT_DLC_KEYWORDS = [
    "DLC", "Expansion", "Append", "Patch", "Soundtrack", "OST",
    "Artbook", "Wallpaper", "Voice Pack", "Bonus", "Fan Disc",
]


def postprocess_records(all_records: list, cat_cfg: dict, language_filter: str = "all") -> list:
    """
    Apply deduplication, DLC filtering, language filtering, and platform limits.

    Args:
        all_records: List of record dicts (camelCase keys).
        cat_cfg: Per-category config with 'block' and 'maxPlat' keys.
        language_filter: 'all', 'en', 'ja', or 'zh'.

    Returns:
        Filtered and deduplicated list.
    """
    pre_filter = len(all_records)

    # Deduplicate by (name, type)
    seen = {}
    deduped = []
    for r in all_records:
        key = (r.get("name", r.get("title", "")).lower().strip(), r.get("type", "game"))
        if not key[0]:
            continue
        if key in seen:
            existing = deduped[seen[key]]
            for kw in r.get("searchKeywords", []):
                if kw not in existing.get("searchKeywords", []):
                    existing.setdefault("searchKeywords", []).append(kw)
        else:
            seen[key] = len(deduped)
            deduped.append(r)

    # Block keyword filtering (per category)
    before = len(deduped)
    filtered = []
    for r in deduped:
        cat = r.get("type", "game")
        block = cat_cfg.get(cat, {}).get("blockKeywords", [])
        if block and is_dlc_title(r.get("title", ""), block):
            continue
        filtered.append(r)
    removed = before - len(filtered)
    if removed:
        print(f"  Block keyword filter: removed {removed}", flush=True)
    deduped = filtered

    # Language filtering
    if language_filter != "all":
        before = len(deduped)
        deduped = [r for r in deduped
                   if detect_desc_language(r.get("description", "")) in (language_filter, "unknown")]
        removed = before - len(deduped)
        if removed:
            print(f"  Language filter ({language_filter}): removed {removed}", flush=True)

    # Per-platform limits
    platform_counts = {}
    final = []
    for r in deduped:
        src = r.get("source", "unknown")
        cat = r.get("type", "game")
        limit = cat_cfg.get(cat, {}).get("maxPerPlatform", 300)
        cnt = platform_counts.get(src, 0)
        if cnt < limit:
            final.append(r)
            platform_counts[src] = cnt + 1
    if len(final) < len(deduped):
        print(f"  Platform limit: removed {len(deduped) - len(final)}", flush=True)

    print(f"Post-processing: {len(final)} records (from {pre_filter} raw)", flush=True)

    # Clean up fields
    for r in final:
        r.setdefault("searchKeywords", [])
        sk = r.get("searchKeywords", [])
        r["searchKeywords"] = [k for k in sk if k != "__TOP__"]
        if not r["searchKeywords"]:
            r["searchKeywords"] = ["(ranking)"]
        r.setdefault("tags", [])
        r.setdefault("rating", "")
        r.setdefault("releaseDate", "")
        r.setdefault("type", "game")

    return final
