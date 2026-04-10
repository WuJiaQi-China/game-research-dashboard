"""
Local test: run scrapers directly without Cloud Functions.
Usage: cd functions && python test_local.py
"""
import json
import sys
import os

# Add functions dir to path so imports work
sys.path.insert(0, os.path.dirname(__file__))

def test_pixiv():
    print("=== Testing Pixiv ===")
    from scrapers.pixiv import scrape_pixiv_artists
    results = scrape_pixiv_artists([], max_per_keyword=5, max_total=5, ranking_mode="week", nsfw_filter=True)
    print(f"Got {len(results)} artists")
    for r in results[:3]:
        print(f"  {r['name']} | views={r.get('totalViews',0):,} | works={r.get('totalWorks',0)} | tags={r.get('tags',[])[: 3]}")
    return results

def test_artstation():
    print("\n=== Testing ArtStation ===")
    from scrapers.artstation import scrape_artstation_artists
    results = scrape_artstation_artists([], max_per_keyword=5, max_total=5, nsfw_filter=True)
    print(f"Got {len(results)} artists")
    for r in results[:3]:
        print(f"  {r['name']} | views={r.get('totalViews',0):,} | tags={r.get('tags',[])[: 3]}")
    return results

def test_yandere():
    print("\n=== Testing Yande.re ===")
    from scrapers.yandere import scrape_yandere_artists
    results = scrape_yandere_artists([], max_per_keyword=5, max_total=5, nsfw_filter=True)
    print(f"Got {len(results)} artists")
    for r in results[:3]:
        print(f"  {r['name']} | views={r.get('totalViews',0):,} | tags={r.get('tags',[])[: 3]}")
    return results

def test_orchestrator():
    print("\n=== Testing Orchestrator (no Firestore) ===")
    from orchestrator import run_pipeline
    config = {
        "sourcesEnabled": {
            "pixiv": True,
            "artstation": True,
            "yandere": True,
        },
        "languageFilter": "all",
        "artist": {
            "searchKeywords": [],
            "maxPerKeyword": 10,
            "maxPerPlatform": 20,
            "blockKeywords": [],
            "rankingMode": "week",
            "nsfwFilter": True,
        },
        "game": {"searchKeywords": [], "maxPerKeyword": 50, "maxPerPlatform": 300, "blockKeywords": []},
        "novel": {"searchKeywords": [], "maxPerKeyword": 50, "maxPerPlatform": 300, "blockKeywords": []},
        "comic": {"searchKeywords": [], "maxPerKeyword": 50, "maxPerPlatform": 300, "blockKeywords": []},
    }
    # Run without Firestore (run_id=None)
    try:
        count = run_pipeline(config, run_id=None)
        print(f"\nPipeline returned: {count} records")
    except Exception as e:
        print(f"\nPipeline error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target = sys.argv[1]
        if target == "pixiv": test_pixiv()
        elif target == "artstation": test_artstation()
        elif target == "yandere": test_yandere()
        elif target == "all": test_orchestrator()
        else: print(f"Unknown target: {target}. Use: pixiv, artstation, yandere, all")
    else:
        # Test each scraper individually
        test_pixiv()
        test_artstation()
        test_yandere()
