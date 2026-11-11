"""ig/<tarih>.jpg + .txt'yi @hakyol.app Instagram hesabında yayınlar.

    IG_TOKEN=... python3 instagram/publish.py [YYYY-AA-GG]

Görsel URL'si raw.githubusercontent (repo herkese açık); dosya önce commit+push edilmiş olmalı.
Token: Meta "Hakyol Paylaşım" uygulaması (1147129041141985), Unified login sistem kullanıcısı
token'ı, süresiz. Yerelde ~/.instagram/hakyol.token, Actions'ta IG_TOKEN secret.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IG_USER = "17841441445490981"
API = "https://graph.facebook.com/v23.0"
RAW = "https://raw.githubusercontent.com/bahadirvolkan/hakyol-web/main/ig"


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
    d = date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else tr_today
    caption = (ROOT / "ig" / f"{d}.txt").read_text().strip()

    # Aynı gün iki kez paylaşmayı önle (workflow yeniden çalıştırılırsa).
    recent = call("GET", f"{IG_USER}/media", fields="caption,timestamp", limit=5).get("data", [])
    if any((m.get("caption") or "").strip() == caption for m in recent):
        print(f"{d} zaten paylaşılmış, atlandı")
        return

    url = f"{RAW}/{d}.jpg"
    for _ in range(10):  # raw.githubusercontent push'tan hemen sonra 404 verebilir
        try:
            urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=20)
            break
        except urllib.error.HTTPError:
            time.sleep(15)

    container = call("POST", f"{IG_USER}/media", image_url=url, caption=caption)["id"]
    for _ in range(20):
        status = call("GET", container, fields="status_code")["status_code"]
        if status == "FINISHED":
            break
        if status == "ERROR":
            sys.exit(f"medya işlenemedi: {call('GET', container, fields='status')}")
        time.sleep(5)
    media = call("POST", f"{IG_USER}/media_publish", creation_id=container)["id"]
    link = call("GET", media, fields="permalink")["permalink"]
    print(f"yayınlandı: {link}")


if __name__ == "__main__":
    main()
