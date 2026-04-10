"""
Firebase Cloud Functions entry points.
Deploy with: firebase deploy --only functions
"""
import json
import time
from firebase_functions import https_fn, options
from firebase_admin import initialize_app, firestore

initialize_app()


@https_fn.on_call(
    timeout_sec=3600,  # 60 min max for full pipeline
    memory=options.MemoryOption.GB_1,
    region="us-central1",
)
def run_scraper(req: https_fn.CallableRequest) -> dict:
    """Trigger the scraping pipeline. Creates a scrapeRun document and starts scraping."""
    db = firestore.client()

    # Read config
    config_doc = db.collection("scrapeConfigs").document("current").get()
    if not config_doc.exists:
        return {"error": "No scrape config found. Save config first."}
    config = config_doc.to_dict()

    # Create scrapeRun document
    run_ref = db.collection("scrapeRuns").document()
    run_ref.set({
        "status": "pending",
        "startedAt": firestore.SERVER_TIMESTAMP,
        "totalStages": 0,
        "currentStageIndex": 0,
        "currentStageName": "Initializing...",
        "stageProgress": 0.0,
        "progressMessage": "Starting...",
        "logLines": [],
        "savedCount": 0,
    })

    try:
        from orchestrator import run_pipeline
        saved = run_pipeline(config, run_id=run_ref.id)
        return {"runId": run_ref.id, "savedCount": saved}
    except Exception as e:
        run_ref.update({
            "status": "failed",
            "error": str(e)[:500],
            "progressMessage": f"Failed: {str(e)[:200]}",
        })
        return {"error": str(e)[:500], "runId": run_ref.id}


@https_fn.on_call(region="us-central1")
def stop_scraper(req: https_fn.CallableRequest) -> dict:
    """Stop a running scraper by setting its status to 'stopped'."""
    run_id = req.data.get("runId")
    if not run_id:
        return {"error": "runId required"}

    db = firestore.client()
    db.collection("scrapeRuns").document(run_id).update({
        "status": "stopped",
        "progressMessage": "Stopped by user.",
    })
    return {"success": True}


@https_fn.on_call(region="us-central1")
def check_source(req: https_fn.CallableRequest) -> dict:
    """Check if a single scraper source is accessible."""
    source_key = req.data.get("sourceKey")
    if not source_key:
        return {"error": "sourceKey required"}

    from scrapers.base import safe_get

    PROBES = {
        "vndb": "https://api.vndb.org/kana/vn",
        "itchio": "https://itch.io/games/tag-otome",
        "steam": "https://store.steampowered.com/search/?term=otome",
        "pixiv": "https://www.pixiv.net/ranking.php?mode=daily&content=illust&format=json&p=1",
        "artstation": "https://www.artstation.com/projects.json?page=1&per_page=1",
        "yandere": "https://yande.re/tag.json?limit=1&order=count&type=1",
        "webtoons": "https://www.webtoons.com/en/search?keyword=romance",
        "mangadex": "https://api.mangadex.org/manga?title=test&limit=1",
        "wattpad": "https://www.wattpad.com/api/v3/stories?query=otome&limit=1",
    }

    url = PROBES.get(source_key)
    if not url:
        return {"ok": False, "reason": "Unknown source"}

    try:
        r = safe_get(url)
        if r and r.status_code == 200:
            return {"ok": True, "reason": "OK"}
        return {"ok": False, "reason": f"HTTP {r.status_code if r else 'no response'}"}
    except Exception as e:
        return {"ok": False, "reason": str(e)[:100]}


@https_fn.on_call(
    timeout_sec=120,
    memory=options.MemoryOption.MB_512,
    region="us-central1",
)
def run_trend_analysis(req: https_fn.CallableRequest) -> dict:
    """Run LLM trend analysis on scraped data. Placeholder for Gemini integration."""
    api_key = req.data.get("apiKey")
    lang = req.data.get("lang", "zh")

    if not api_key:
        return {"error": "Gemini API key required"}

    db = firestore.client()

    # Fetch all records
    records = [doc.to_dict() for doc in db.collection("records").stream()]
    if not records:
        return {"error": "No data to analyze"}

    # Build analysis prompt (simplified)
    record_summary = []
    for r in records[:200]:
        tags = ", ".join(r.get("tags", [])[:5])
        record_summary.append(f"- {r.get('title', '')} [{r.get('source', '')}] tags: {tags}")

    prompt = f"""Analyze the following {len(records)} content records and identify the top 10 trends.
For each trend, provide: name, description, representative tags, example titles, and a popularity score (1-100).

Records sample:
{chr(10).join(record_summary[:100])}

Respond in {'Chinese' if lang == 'zh' else 'English'} as JSON array."""

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        # Store result
        analysis_ref = db.collection("trendAnalyses").document()
        analysis_ref.set({
            "lang": lang,
            "trends": [],  # Would parse from response
            "summary": response.text[:2000] if response.text else "",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "recordCount": len(records),
            "rawResponse": response.text[:5000] if response.text else "",
        })
        return {"analysisId": analysis_ref.id, "summary": response.text[:1000] if response.text else ""}
    except Exception as e:
        return {"error": str(e)[:500]}
