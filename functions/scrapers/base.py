"""
Shared utilities for all scrapers.
Replaces the global helpers from the monolithic pipeline_descriptions.py.
"""
import time
import re
import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)


def safe_get(url, **kw):
    """Retry-enabled HTTP GET with exponential backoff."""
    for i in range(3):
        try:
            r = SESSION.get(url, timeout=15, **kw)
            r.raise_for_status()
            return r
        except Exception as e:
            print(f"  [retry {i+1}] {url}: {e}", flush=True)
            time.sleep(2 ** i)
    return None


def upload_cover_to_storage(image_url: str, record_id: str, referer: str = "") -> str:
    """Download image and upload to Firebase Storage. Returns the storage path or empty string."""
    if not image_url:
        return ""
    safe_id = re.sub(r'[^\w\-]', '_', str(record_id))
    ext = ".jpg"
    m = re.search(r'\.(png|jpg|jpeg|webp|gif)', image_url.lower())
    if m:
        ext = f".{m.group(1)}"
    storage_path = f"covers/{safe_id}{ext}"

    try:
        headers = {"Referer": referer} if referer else {}
        r = SESSION.get(image_url, timeout=15, stream=True, headers=headers)
        if r.status_code != 200:
            return ""
        data = r.content

        from google.cloud import storage as gcs
        bucket = gcs.Client().bucket()
        blob = bucket.blob(storage_path)
        if blob.exists():
            return storage_path
        blob.upload_from_string(data, content_type=f"image/{ext.lstrip('.')}")
        return storage_path
    except Exception as e:
        print(f"[WARN] cover upload failed ({safe_id}): {e}", flush=True)
        return ""


def download_cover(image_url: str, record_id: str, referer: str = "") -> str:
    """Compatibility wrapper — returns image_url directly for Cloud deployment.
    Cover upload to Storage is optional and done in post-processing."""
    return image_url if image_url else ""


class ProgressTracker:
    """Tracks scraper progress by updating a Firestore document."""

    def __init__(self, run_id: str = None):
        self.run_id = run_id
        if run_id:
            from google.cloud import firestore
            self.db = firestore.Client()
        else:
            self.db = None
        self.log_lines = []

    def emit_stage(self, idx: int, total: int, name: str):
        print(f"STAGE:{idx}:{total}:{name}", flush=True)
        if self.db and self.run_id:
            self.db.collection("scrapeRuns").document(self.run_id).update({
                "currentStageIndex": idx,
                "totalStages": total,
                "currentStageName": name,
                "stageProgress": 0.0,
            })

    def emit_progress(self, current: int, total: int, message: str):
        print(f"PROG:{current}:{total}:{message}", flush=True)
        self.log_lines.append(message)
        if len(self.log_lines) > 30:
            self.log_lines = self.log_lines[-20:]
        if self.db and self.run_id:
            self.db.collection("scrapeRuns").document(self.run_id).update({
                "stageProgress": current / total if total else 0,
                "progressMessage": message,
                "logLines": self.log_lines[-15:],
            })

    def emit_save(self, count: int):
        print(f"SAVE:{count}", flush=True)
        if self.db and self.run_id:
            self.db.collection("scrapeRuns").document(self.run_id).update({
                "savedCount": count,
            })

    def is_stopped(self) -> bool:
        """Check if the user requested a stop."""
        if not self.db or not self.run_id:
            return False
        try:
            doc = self.db.collection("scrapeRuns").document(self.run_id).get()
            return doc.exists and doc.to_dict().get("status") == "stopped"
        except Exception:
            return False
