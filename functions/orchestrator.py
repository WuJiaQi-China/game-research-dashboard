"""
Scraper orchestration — runs enabled scrapers, writes results to Firestore.
Replaces the main() function from pipeline_descriptions.py.
"""
import time
from google.cloud import firestore
from postprocess import postprocess_records, DEFAULT_DLC_KEYWORDS

# Source → category mapping
GAME_SOURCES = {"vndb", "itchio", "erogames", "steam", "dlsite",
                "nutaku", "gamejolt", "lemmasoft", "hanako", "otome_obsessed"}
NOVEL_SOURCES = {"wattpad", "ao3", "dreame", "jjwxc"}
COMIC_SOURCES = {"webtoons", "mangadex"}
ARTIST_SOURCES = {"pixiv", "artstation", "yandere"}

STAGE_MAP = [
    ("vndb", "VNDB API"),
    ("itchio", "itch.io"),
    ("erogames", "erogames.to"),
    ("steam", "Steam"),
    ("dlsite", "DLsite"),
    ("nutaku", "Nutaku"),
    ("gamejolt", "GameJolt"),
    ("lemmasoft", "Lemmasoft"),
    ("hanako", "Hanako Games"),
    ("otome_obsessed", "Otome Obsessed"),
    ("wattpad", "Wattpad"),
    ("webtoons", "Webtoons"),
    ("mangadex", "MangaDex"),
    ("ao3", "AO3"),
    ("dreame", "Dreame"),
    ("jjwxc", "JJWXC"),
    ("pixiv", "Pixiv (Artists)"),
    ("artstation", "ArtStation (Artists)"),
    ("yandere", "Yande.re (Artists)"),
]


def source_category(key):
    if key in NOVEL_SOURCES: return "novel"
    if key in COMIC_SOURCES: return "comic"
    if key in ARTIST_SOURCES: return "artist"
    return "game"


def _get_scraper(stage_key):
    """Lazy import scraper functions to avoid loading all modules at once."""
    if stage_key == "vndb":
        from scrapers.vndb import fetch_vndb_descriptions
        return fetch_vndb_descriptions
    elif stage_key == "itchio":
        from scrapers.itchio import scrape_itchio_descriptions
        return scrape_itchio_descriptions
    elif stage_key == "erogames":
        from scrapers.erogames import scrape_erogames_descriptions
        return scrape_erogames_descriptions
    elif stage_key == "steam":
        from scrapers.steam import scrape_steam_descriptions
        return scrape_steam_descriptions
    elif stage_key == "dlsite":
        from scrapers.dlsite import scrape_dlsite_descriptions
        return scrape_dlsite_descriptions
    elif stage_key == "nutaku":
        from scrapers.nutaku import scrape_nutaku_descriptions
        return scrape_nutaku_descriptions
    elif stage_key == "hanako":
        from scrapers.hanako import scrape_hanako_descriptions
        return scrape_hanako_descriptions
    elif stage_key == "otome_obsessed":
        from scrapers.otome_obsessed import scrape_otome_obsessed_descriptions
        return scrape_otome_obsessed_descriptions
    elif stage_key == "wattpad":
        from scrapers.wattpad import scrape_wattpad
        return scrape_wattpad
    elif stage_key == "webtoons":
        from scrapers.webtoons import scrape_webtoons
        return scrape_webtoons
    elif stage_key == "mangadex":
        from scrapers.mangadex import scrape_mangadex
        return scrape_mangadex
    elif stage_key == "ao3":
        from scrapers.ao3 import scrape_ao3
        return scrape_ao3
    elif stage_key == "dreame":
        from scrapers.dreame import scrape_dreame
        return scrape_dreame
    elif stage_key == "jjwxc":
        from scrapers.jjwxc import scrape_jjwxc
        return scrape_jjwxc
    elif stage_key == "pixiv":
        from scrapers.pixiv import scrape_pixiv_artists
        return scrape_pixiv_artists
    elif stage_key == "artstation":
        from scrapers.artstation import scrape_artstation_artists
        return scrape_artstation_artists
    elif stage_key == "yandere":
        from scrapers.yandere import scrape_yandere_artists
        return scrape_yandere_artists
    return None


def run_pipeline(config: dict, run_id: str = None):
    """
    Execute the scraping pipeline based on config.

    Args:
        config: ScrapeConfig dict from Firestore.
        run_id: Optional scrapeRuns document ID for progress tracking.

    Returns:
        Number of records saved.
    """
    db = firestore.Client()
    run_ref = db.collection("scrapeRuns").document(run_id) if run_id else None

    def update_run(**fields):
        if run_ref:
            try:
                run_ref.update(fields)
            except Exception:
                pass

    # Parse config
    sources_enabled = config.get("sourcesEnabled", {})
    language_filter = config.get("languageFilter", "all")

    cat_cfg = {
        "game": config.get("game", {}),
        "novel": config.get("novel", {}),
        "comic": config.get("comic", {}),
        "artist": config.get("artist", {}),
    }

    # Default values
    for cat in cat_cfg.values():
        cat.setdefault("searchKeywords", [])
        cat.setdefault("maxPerKeyword", 50)
        cat.setdefault("maxPerPlatform", 300)
        cat.setdefault("blockKeywords", [])

    # Determine enabled stages
    enabled_stages = [(key, name) for key, name in STAGE_MAP
                      if sources_enabled.get(key, False)]

    if not enabled_stages:
        print("No sources enabled!", flush=True)
        update_run(status="completed", savedCount=0,
                   progressMessage="No sources enabled")
        return 0

    update_run(status="running", totalStages=len(enabled_stages))
    print(f"Enabled {len(enabled_stages)} sources: {', '.join(s[1] for s in enabled_stages)}", flush=True)

    all_records = []
    log_lines = []

    for stage_idx, (stage_key, stage_name) in enumerate(enabled_stages):
        # Check for stop signal
        if run_ref:
            try:
                doc = run_ref.get()
                if doc.exists and doc.to_dict().get("status") == "stopped":
                    print("Stopped by user.", flush=True)
                    break
            except Exception:
                pass

        update_run(
            currentStageIndex=stage_idx,
            currentStageName=stage_name,
            stageProgress=0.0,
        )

        cat = source_category(stage_key)
        cc = cat_cfg.get(cat, {})
        kw = cc.get("searchKeywords", [])
        mk = cc.get("maxPerKeyword", 50)
        mp = cc.get("maxPerPlatform", 300)

        if not kw:
            kw = ["__TOP__"]

        scraper_fn = _get_scraper(stage_key)
        if not scraper_fn:
            log_lines.append(f"Unknown scraper: {stage_key}")
            continue

        try:
            msg = f"Scraping {stage_name}..."
            log_lines.append(msg)
            update_run(progressMessage=msg, logLines=log_lines[-15:])

            # Artist scrapers have extra params
            if stage_key in ARTIST_SOURCES:
                nsfw = cc.get("nsfwFilter", True)
                extra = {"nsfw_filter": nsfw}
                if stage_key == "pixiv":
                    extra["ranking_mode"] = cc.get("rankingMode", "week")
                results = scraper_fn(kw, mk, mp, **extra)
            elif stage_key == "dlsite":
                results = scraper_fn(kw, mk, mp,
                                     dlsite_categories=config.get("dlsiteCategories"),
                                     language_filter=language_filter)
            else:
                results = scraper_fn(kw, mk, mp)

            msg = f"{stage_name}: {len(results)} records"
            log_lines.append(msg)
            all_records += results
            update_run(stageProgress=1.0, progressMessage=msg, logLines=log_lines[-15:])
        except Exception as e:
            msg = f"{stage_name} failed: {str(e)[:100]}"
            log_lines.append(msg)
            print(f"  ERROR: {msg}", flush=True)
            update_run(progressMessage=msg, logLines=log_lines[-15:])

    # Post-processing
    update_run(progressMessage="Post-processing...")
    final = postprocess_records(all_records, cat_cfg, language_filter)

    # Write to Firestore in batches
    update_run(progressMessage=f"Writing {len(final)} records to Firestore...")
    BATCH_SIZE = 500
    written = 0
    for i in range(0, len(final), BATCH_SIZE):
        batch = db.batch()
        chunk = final[i:i + BATCH_SIZE]
        for r in chunk:
            doc_id = r.get("id", f"auto_{written}")
            safe_id = doc_id.replace("/", "_")
            batch.set(db.collection("records").document(safe_id), r)
        batch.commit()
        written += len(chunk)
        update_run(savedCount=written, progressMessage=f"Saved {written}/{len(final)}")

    update_run(
        status="completed",
        savedCount=written,
        progressMessage=f"Done! {written} records saved.",
        logLines=log_lines[-15:],
    )
    print(f"Pipeline complete: {written} records saved.", flush=True)
    return written
