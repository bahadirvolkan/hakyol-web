"""ig/<tarih>.jpg + .txt'yi (gönderi) ya da ig/<tarih>-s<N>.jpg'yi (hikâye) @hakyol.app'te yayınlar.

    IG_TOKEN=... python3 instagram/publish.py [YYYY-AA-GG] [--story N]

Görsel URL'si raw.githubusercontent'teki ig-media dalı (repo herkese açık); workflow dosyayı
yayından önce oraya iter.
Token: Meta "Hakyol Paylaşım" uygulaması (1147129041141985), Unified login sistem kullanıcısı
token'ı, süresiz. Yerelde ~/.instagram/hakyol.token, Actions'ta IG_TOKEN secret.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IG_USER = "17841441445490981"
API = "https://graph.facebook.com/v23.0"
RAW = "https://raw.githubusercontent.com/bahadirvolkan/hakyol-web/ig-media"


def token():
    t = os.environ.get("IG_TOKEN")
    return t or (Path.home() / ".instagram/hakyol.token").read_text().strip()


def call(method, path, **params):
    params["access_token"] = token()
    data = urllib.parse.urlencode(params).encode()
    url = f"{API}/{path}"
    req = urllib.request.Request(url, data=data) if method == "POST" else urllib.request.Request(f"{url}?{data.decode()}")
    try:
        return json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path}: HTTP {e.code} {e.read().decode()[:400]}")


def main():
    tr_today = datetime.now(timezone(timedelta(hours=3))).date()
    args = [a for a in sys.argv[1:] if re.fullmatch(r"\d{4}-\d\d-\d\d", a)]
    d = date.fromisoformat(args[0]) if args else tr_today
    story = "--story" in sys.argv
    name = f"{d}-s{sys.argv[sys.argv.index('--story') + 1]}" if story else f"{d}"

    # Workflow yeniden çalıştırılırsa aynı içeriği iki kez paylaşma.
    if story:
        params = {"media_type": "STORIES"}
        now = datetime.now(timezone.utc)
        live = call("GET", f"{IG_USER}/stories", fields="timestamp").get("data", [])
        if any(now - datetime.strptime(m["timestamp"], "%Y-%m-%dT%H:%M:%S%z") < timedelta(minutes=90) for m in live):
            print(f"{name}: son 90 dakikada hikâye var, atlandı")
            return
    else:
        params = {"caption": (ROOT / "ig" / f"{name}.txt").read_text().strip()}
        recent = call("GET", f"{IG_USER}/media", fields="caption", limit=5).get("data", [])
        if any((m.get("caption") or "").strip() == params["caption"] for m in recent):
            print(f"{name} zaten paylaşılmış, atlandı")
            return

    url = f"{RAW}/{name}.jpg"
    for _ in range(10):  # raw.githubusercontent push'tan hemen sonra 404 verebilir
        try:
            urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=20)
            break
        except urllib.error.HTTPError:
            time.sleep(15)

    container = call("POST", f"{IG_USER}/media", image_url=url, **params)["id"]
    for _ in range(20):
        status = call("GET", container, fields="status_code")["status_code"]
        if status == "FINISHED":
            break
        if status == "ERROR":
            sys.exit(f"medya işlenemedi: {call('GET', container, fields='status')}")
        time.sleep(5)
    media = call("POST", f"{IG_USER}/media_publish", creation_id=container)["id"]
    print(f"yayınlandı: {name} {'' if story else call('GET', media, fields='permalink')['permalink']}")


if __name__ == "__main__":
    main()
