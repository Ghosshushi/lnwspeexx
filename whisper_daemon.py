from concurrent.futures import ThreadPoolExecutor
import copy
import glob
import http.server
import json
import os
import re
import socket
import socketserver
import subprocess
import sys
import tempfile
import threading
import urllib.parse
import urllib.request
import uuid
from datetime import datetime

try:
    import av
    _orig_av_open = av.open
    def _compat_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)
    av.open = _compat_av_open
    from faster_whisper import WhisperModel
except ImportError:
    print("[AUTO-FIX] Installing faster-whisper for this Python environment...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "faster-whisper", "requests"])
    import av
    _orig_av_open = av.open
    def _compat_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)
    av.open = _compat_av_open
    from faster_whisper import WhisperModel

os.system("")
if os.name == "nt":
    os.system("title Speexx Whisper Daemon + RAM Cache Server [Port 8765]")

C_RESET  = "\033[0m"
C_BOLD   = "\033[1m"
C_CYAN   = "\033[96m"
C_GREEN  = "\033[92m"
C_YELLOW = "\033[93m"
C_BLUE   = "\033[94m"
C_RED    = "\033[91m"
C_GRAY   = "\033[90m"

PORT = 8765
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, "answers_db.json")
HELPER_FILE = os.path.join(BASE_DIR, "speexx_helper.js")
TEMP_DIR = tempfile.gettempdir()

# Separate ultra-fast RAM lock (<0.05ms) from Disk I/O lock so HTTP requests NEVER block on disk!
ram_lock = threading.RLock()
disk_lock = threading.Lock()
whisper_lock = threading.Lock()
_db_dirty = False
_flush_running = False
_helper_cache = {"mtime": 0.0, "bytes": b""}
audio_pool = ThreadPoolExecutor(max_workers=4)


def now():
    return f"{C_GRAY}[{datetime.now().strftime('%H:%M:%S')}]{C_RESET}"


def cleanup_stray_mp3():
    for pattern in ("temp_*.mp3", "daemon_temp*.mp3"):
        for path in glob.glob(os.path.join(BASE_DIR, pattern)):
            try:
                os.remove(path)
            except OSError:
                pass


def normalize_page_key(page_key):
    if not page_key or not isinstance(page_key, str):
        return ""
    raw = page_key.strip()

    # 1. Speexx platform (...-packet/...) -> strip User/Article ID prefix
    no_qh = raw.split("?")[0].split("#")[0]
    clean_s = re.sub(r'^https?://[^/]+', '', no_qh)
    clean_s = re.sub(r'^.*?/articles/\d+/', '', clean_s)
    clean_s = re.sub(r'^/?articles/', '', clean_s)
    clean_s = re.sub(r'^\d+/', '', clean_s)
    clean_s = clean_s.strip('/')
    clean_s = re.sub(r'^([a-z0-9-]+-packet)-(\d+)-(exercise)-(\d+)$', r'\1/\2/\3/\4', clean_s)
    pkt_match = re.search(r'([a-z0-9-]+-packet/.+)$', clean_s)
    if pkt_match:
        return pkt_match.group(1).strip('/')

    # 2. Cambridge or other platforms -> strip domain & personal query/tokens, keep Path/Activity ID or Unit+Activity
    no_origin = re.sub(r'^https?://[^/]+', '', raw)
    if "#" in no_origin:
        path_part, hash_part = no_origin.split("#", 1)
    else:
        path_part, hash_part = no_origin, ""

    path_part = path_part.split("?")[0]
    hash_part = hash_part.split("?")[0]

    personal_seg = re.compile(
        r'/(?:users?|students?|learners?|attempts?|enrollments?|sessions?|org|organizations?|classes|class|groups?|articles|tokens?|launch|lti)'
        r'/(?:[0-9]+|[0-9a-fA-F]{8,}|[0-9a-fA-F-]{12,})(?=/|$)',
        re.IGNORECASE
    )
    path_part = personal_seg.sub('', path_part)
    hash_part = personal_seg.sub('', hash_part)

    path_part = re.sub(r'^\d+/', '', path_part.strip('/'))
    hash_part = hash_part.strip('/').lstrip('#').strip('/')

    combined = f"{path_part}#{hash_part}" if (path_part and hash_part) else (path_part or hash_part)
    # Extract concise unit/activity path if deeply nested
    cam_match = re.search(r'((?:unit|module|lesson|level|course|product|item|activity|exercise|workbook)[^?#]*)$', combined, re.IGNORECASE)
    if cam_match:
        return cam_match.group(1).strip('/')
    return combined


def normalize_audio_key(audio_url_or_key):
    if not audio_url_or_key or not isinstance(audio_url_or_key, str):
        return ""
    return audio_url_or_key.strip().split("/")[-1].split("?")[0].split("#")[0]


cleanup_stray_mp3()

# Load into RAM Cache ONCE at startup (never re-read from disk on get_page!)
answer_db = {"audio": {}, "pages": {}}
if os.path.exists(DB_FILE):
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            loaded = json.load(f)
            if isinstance(loaded, dict):
                answer_db["audio"] = loaded.get("audio", {})
                answer_db["pages"] = loaded.get("pages", {})
    except Exception as e:
        print(f"  {now()} {C_RED}[DB WARN  ]{C_RESET} Error reading DB: {e}")


def save_db_sync():
    """Synchronous disk write (used at startup migration only)."""
    with ram_lock:
        snapshot = {
            "audio": dict(answer_db["audio"]),
            "pages": copy.deepcopy(answer_db["pages"])
        }
    with disk_lock:
        temp_db = f"{DB_FILE}.{uuid.uuid4().hex[:6]}.tmp"
        with open(temp_db, "w", encoding="utf-8") as f:
            json.dump(snapshot, f, ensure_ascii=False, indent=2)
        os.replace(temp_db, DB_FILE)


def _flush_db_worker():
    """Background worker thread: coalesces dirty RAM updates onto disk without blocking HTTP threads."""
    global _db_dirty, _flush_running
    try:
        while True:
            with ram_lock:
                if not _db_dirty:
                    _flush_running = False
                    return
                _db_dirty = False
                snapshot = {
                    "audio": dict(answer_db["audio"]),
                    "pages": copy.deepcopy(answer_db["pages"])
                }
            with disk_lock:
                temp_db = f"{DB_FILE}.{uuid.uuid4().hex[:6]}.tmp"
                try:
                    with open(temp_db, "w", encoding="utf-8") as f:
                        json.dump(snapshot, f, ensure_ascii=False, indent=2)
                    os.replace(temp_db, DB_FILE)
                except Exception as e:
                    print(f"  {now()} {C_RED}[DISK ERR ]{C_RESET} {e}", flush=True)
                    if os.path.exists(temp_db):
                        try:
                            os.remove(temp_db)
                        except OSError:
                            pass
    finally:
        with ram_lock:
            if not _db_dirty:
                _flush_running = False


def save_db_async():
    """Mark RAM cache dirty and spawn non-blocking background thread to persist answers_db.json."""
    global _db_dirty, _flush_running
    with ram_lock:
        _db_dirty = True
        if _flush_running:
            return
        _flush_running = True
    threading.Thread(target=_flush_db_worker, daemon=True).start()


def get_helper_js_bytes():
    """Serve speexx_helper.js from RAM with mtime auto-refresh."""
    if not os.path.exists(HELPER_FILE):
        return None
    mtime = os.path.getmtime(HELPER_FILE)
    if _helper_cache["bytes"] and _helper_cache["mtime"] == mtime:
        return _helper_cache["bytes"]
    with open(HELPER_FILE, "rb") as f:
        data = f.read()
    _helper_cache["mtime"] = mtime
    _helper_cache["bytes"] = data
    return data


def normalize_all_db():
    migrated = 0
    new_pages = {}
    for k, v in list(answer_db.get("pages", {}).items()):
        norm_k = normalize_page_key(k)
        if norm_k != k:
            migrated += 1
        if norm_k:
            new_pages[norm_k] = v

    new_audio = {}
    for k, v in list(answer_db.get("audio", {}).items()):
        norm_a = normalize_audio_key(k)
        if norm_a != k:
            migrated += 1
        if norm_a:
            new_audio[norm_a] = v

    answer_db["pages"] = new_pages
    answer_db["audio"] = new_audio
    if migrated > 0:
        save_db_sync()
        print(f"  {now()} {C_GREEN}[CROSS-SYNC]{C_RESET} Normalized {migrated} keys for cross-account sharing!")


normalize_all_db()

print(f"{C_CYAN}=============================================================={C_RESET}")
print(f"{C_BOLD}   SPEEXX TURBO DAEMON (NON-BLOCKING RAM CACHE + WHISPER)     {C_RESET}")
print(f"{C_CYAN}=============================================================={C_RESET}")
print(f"  {now()} {C_BLUE}[CACHE]{C_RESET}  Audio in RAM : {C_BOLD}{len(answer_db['audio'])}{C_RESET} files")
print(f"  {now()} {C_BLUE}[CACHE]{C_RESET}  Pages in RAM : {C_BOLD}{len(answer_db['pages'])}{C_RESET} pages")
print(f"  {now()} {C_YELLOW}[INIT ]{C_RESET}  Loading faster-whisper (base.en / int8)...")

whisper = WhisperModel("base.en", device="cpu", compute_type="int8")

print(f"  {now()} {C_GREEN}[READY]{C_RESET}  API    : {C_BOLD}http://localhost:{PORT}{C_RESET} (<5ms RAM Cache)")
print(f"  {now()} {C_GREEN}[READY]{C_RESET}  Helper : {C_BOLD}http://localhost:{PORT}/helper.js{C_RESET}")
print(f"{C_CYAN}--------------------------------------------------------------{C_RESET}\n", flush=True)


def clean_text(text):
    text = re.sub(r'[\-\.]', '', text)
    text = re.sub(r'(?:new|nu|you|no|u)\s*word|\bspace\b', ' | ', text, flags=re.IGNORECASE)
    text = re.sub(r'[^a-zA-Z0-9\s|]', '', text)
    text = re.sub(r'(?<=\b[a-zA-Z])\s+(?=[a-zA-Z]\b)', '', text)
    words = [w.capitalize() for w in text.replace('|', ' ').split()]
    return " ".join(words).strip()


def transcribe_single(audio_url):
    if not audio_url or not isinstance(audio_url, str) or not audio_url.startswith("http"):
        return ""

    audio_key = normalize_audio_key(audio_url)
    if not audio_key.endswith(".mp3"):
        return ""

    with ram_lock:
        cached = answer_db["audio"].get(audio_key)
    if cached:
        print(f"  {now()} {C_CYAN}[AUDIO HIT]{C_RESET} {audio_key:<22} -> {C_BOLD}{cached}{C_RESET}", flush=True)
        return cached

    temp_file = os.path.join(TEMP_DIR, f"speexx_{uuid.uuid4().hex[:8]}.mp3")
    try:
        req = urllib.request.Request(
            audio_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                "Referer": "https://portal.speexx.com/",
                "Origin": "https://portal.speexx.com"
            }
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            audio_data = response.read()

        if len(audio_data) < 500 or audio_data.lstrip().startswith((b"<!DOCTYPE", b"<html", b"<?xml", b"{")):
            print(f"  {now()} {C_RED}[SKIP BAD ]{C_RESET} {audio_key:<22} -> Invalid audio response", flush=True)
            return ""

        with open(temp_file, "wb") as f:
            f.write(audio_data)

        with whisper_lock:
            segments, _ = whisper.transcribe(temp_file, beam_size=1)
            res = clean_text("".join([s.text for s in segments]))

        if res:
            with ram_lock:
                answer_db["audio"][audio_key] = res
            save_db_async()
        print(f"  {now()} {C_YELLOW}[WHISPER  ]{C_RESET} {audio_key:<22} -> {C_GREEN}{C_BOLD}{res}{C_RESET}", flush=True)
        return res

    except Exception as e:
        print(f"  {now()} {C_RED}[AUDIO ERR]{C_RESET} {audio_key:<22} -> {str(e)}", flush=True)
        return ""
    finally:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except OSError:
                pass


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 64

    def server_bind(self):
        super().server_bind()
        try:
            self.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except OSError:
            pass


class WhisperHandler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def setup(self):
        try:
            self.request.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except OSError:
            pass
        super().setup()

    def _cors_headers(self):
        return (
            "Access-Control-Allow-Origin: *\r\n"
            "Access-Control-Allow-Methods: POST, GET, OPTIONS\r\n"
            "Access-Control-Allow-Headers: *\r\n"
            "Access-Control-Allow-Private-Network: true\r\n"
            "Cache-Control: no-store\r\n"
            "Connection: close\r\n"
        )

    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        status_text = "OK" if status == 200 else "Not Found"
        head = (
            f"HTTP/1.1 {status} {status_text}\r\n"
            f"{self._cors_headers()}"
            f"Content-Type: application/json; charset=utf-8\r\n"
            f"Content-Length: {len(body)}\r\n\r\n"
        ).encode("ascii")
        # Single atomic socket write avoids Windows TCP delayed-ACK (~40ms+ saved -> <3ms latency!)
        self.wfile.write(head + body)
        self.wfile.flush()

    def do_OPTIONS(self):
        head = f"HTTP/1.1 200 OK\r\n{self._cors_headers()}Content-Length: 0\r\n\r\n".encode("ascii")
        self.wfile.write(head)
        self.wfile.flush()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path.rstrip('/') or '/'

        if route == '/helper.js':
            js_bytes = get_helper_js_bytes()
            if js_bytes is None:
                self._send_json({"error": "speexx_helper.js not found"}, status=404)
                return
            head = (
                f"HTTP/1.1 200 OK\r\n"
                f"{self._cors_headers()}"
                f"Content-Type: application/javascript; charset=utf-8\r\n"
                f"Content-Length: {len(js_bytes)}\r\n\r\n"
            ).encode("ascii")
            self.wfile.write(head + js_bytes)
            self.wfile.flush()
            return

        if route == '/get_page':
            qs = urllib.parse.parse_qs(parsed.query)
            raw_key = (qs.get('page_key') or qs.get('key') or [''])[0]
            page_key = normalize_page_key(raw_key)
            with ram_lock:
                cached_ans = answer_db["pages"].get(page_key)
            self._send_json({
                "found": cached_ans is not None,
                "answers": cached_ans,
                "page_key": page_key
            })
            return

        with ram_lock:
            p_cnt = len(answer_db["pages"])
            a_cnt = len(answer_db["audio"])
        self._send_json({
            "status": "online",
            "helper": f"http://localhost:{PORT}/helper.js",
            "pages_cached": p_cnt,
            "audio_cached": a_cnt
        })

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            raw_bytes = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                raw_body = raw_bytes.decode('utf-8')
            except UnicodeDecodeError:
                raw_body = raw_bytes.decode('cp1252', errors='replace')
            data = json.loads(raw_body)
            action = data.get("action", "transcribe")

            # 1. Instant RAM Cache lookup (<5ms, zero disk I/O)
            if action == "get_page":
                page_key = normalize_page_key(data.get("page_key", ""))
                with ram_lock:
                    cached_ans = answer_db["pages"].get(page_key)
                self._send_json({
                    "found": cached_ans is not None,
                    "answers": cached_ans,
                    "page_key": page_key
                })
                if cached_ans is not None:
                    count = len(cached_ans) if isinstance(cached_ans, (list, dict)) else 1
                    threading.Thread(
                        target=print,
                        args=(f"  {now()} {C_CYAN}[RAM HIT  ]{C_RESET} {page_key} -> Instant ({count} items)",),
                        kwargs={"flush": True},
                        daemon=True
                    ).start()
                return

            # 2. Instant RAM Cache write + background disk flush thread (zero disk wait)
            if action == "save_page":
                page_key = normalize_page_key(data.get("page_key", ""))
                answers = data.get("answers")
                total = 0
                if page_key and answers is not None:
                    with ram_lock:
                        answer_db["pages"][page_key] = answers
                        total = len(answer_db["pages"])
                    save_db_async()
                self._send_json({"status": "saved", "page_key": page_key})
                if page_key and answers is not None:
                    threading.Thread(
                        target=print,
                        args=(f"  {now()} {C_GREEN}[RAM+ASYNC]{C_RESET} {page_key} (Total: {total} pages)",),
                        kwargs={"flush": True},
                        daemon=True
                    ).start()
                return

            # 3. Parallel download + Whisper batch transcription
            if action == "batch_transcribe":
                urls = data.get("urls", [])
                results = list(audio_pool.map(transcribe_single, urls)) if urls else []
                self._send_json({"results": results})
                return

            result = transcribe_single(data.get("url", ""))
            self._send_json({"result": result})

        except Exception as e:
            self._send_json({"result": "", "error": str(e)})
            print(f"  {now()} {C_RED}[ERROR    ]{C_RESET} {str(e)}", flush=True)

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    try:
        with ThreadedHTTPServer(("", PORT), WhisperHandler) as httpd:
            httpd.serve_forever()
    except OSError as e:
        print(f"\n  {now()} {C_RED}[PORT BUSY]{C_RESET} Port {PORT} is already running in another window! ({e})")
        if sys.stdin and sys.stdin.isatty():
            input("\nPress Enter to close...")
