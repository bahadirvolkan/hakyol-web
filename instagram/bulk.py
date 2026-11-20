"""queue.json'daki sıradaki reels'i üretip yayınlar (saat başı workflow: instagram-bulk.yml).

    IG_TOKEN=... python3 instagram/bulk.py [--dry] [--count N --gap SANİYE]

Durumsuz: son ~300 gönderinin içeriğine bakar, henüz paylaşılmamış ilk öğeyi seçer (sabah: dua + 3 sabah ayeti).
Tekli öğe: places.reel (yavaş yakınlaşma, 6-8 sn). Paket: kart başına kısa klipler, geçişli,
tek fon müziği. Video tek dosyalık ig-bulk dalına itilir (raw URL).
"""
import random
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import places as PL
import publish as P
import render as R
import replies
import json

HERE = Path(__file__).resolve().parent
OUT = R.OUT / "bulk"
RAW = "https://raw.githubusercontent.com/bahadirvolkan/hakyol-web/ig-bulk"
TSI = timezone(timedelta(hours=3))


PREFIXES = ("Kur'an'daki dualar.", "Hayırlı sabahlar, hayırlı işler.", "Hayırlı Cumalar.")


def key(caption):
    """Aynı ayet/hadis farklı açıklama kalıbıyla (eski/yeni CTA, sabah, dua) ikinci kez paylaşılmasın: ilk içerik paragrafı."""
    paras = [p for p in caption.strip().split("\n\n") if p.strip() not in PREFIXES]
    return re.sub(r"\W+", "", paras[0].lower())[:80] if paras else ""


def published():
    """Son ~300 gönderi: (içerik anahtarları, bugün TSİ yayınlananların açıklamaları)."""
    keys, today, params = set(), [], {"fields": "caption,timestamp", "limit": 100}
    tsi = lambda ts: datetime.strptime(ts, "%Y-%m-%dT%H:%M:%S%z").astimezone(TSI)
    now = datetime.now(TSI)
    for _ in range(3):
        page = P.call("GET", f"{P.IG_USER}/media", **params)
        for m in page["data"]:
            cap = (m.get("caption") or "").strip()
            keys.add(key(cap))
            if tsi(m["timestamp"]).date() == now.date():
                today.append(cap)
        after = page.get("paging", {}).get("cursors", {}).get("after")
        if not page.get("paging", {}).get("next") or not after:
            break
        params["after"] = after
    return keys, today


def choose(queue, keys, today, hour):
    """Sabah (TSİ 05-11): önce bir dua, sonra 3 'Hayırlı sabahlar' ayeti; gün içinde normal sıra (ayet, ayet, dua)."""
    fresh = [q for q in queue if q["kind"] != "pack" and key(q["caption"]) not in keys]
    if 5 <= hour < 11:  # gece yarısından sonraki son tur sabah sayılmasın (11-20: 01:52 "Hayırlı sabahlar")
        if not any(c.startswith("Kur'an'daki dualar") for c in today):
            dua = next((q for q in fresh if q.get("slot") == "dua"), None)
            if dua:
                return dua
        if sum(c.startswith("Hayırlı sabahlar") for c in today) < 3:
            sabah = next((q for q in fresh if q.get("slot") == "sabah"), None)
            if sabah:
                return sabah
    return next((q for q in fresh if q.get("slot") != "sabah"), None)


def pack_video(cards, mp4, seed):
    """Başlık 3.5 sn, ayet kartları 6 sn, son kart 4 sn; kartlar arası 0.5 sn geçiş, tek müzik."""
    clips, durs = [], []
    for i, body in enumerate(cards):
        jpg = OUT / f"{mp4.stem}-{i}.jpg"
        R.shoot(body, jpg, story=True)
        d = 3.5 if i == 0 else 4 if i == len(cards) - 1 else 6
        clip = OUT / f"{mp4.stem}-{i}.mp4"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", "30", "-t", str(d), "-i", str(jpg),
                        "-vf", f"fade=t=in:d=0.5,fade=t=out:st={d - 0.5}:d=0.5,format=yuv420p",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", str(clip)], check=True)
        clips.append(clip)
        durs.append(d)
    lst = OUT / f"{mp4.stem}.list"
    lst.write_text("".join(f"file '{c}'\n" for c in clips))
    total = sum(durs)
    rnd = random.Random(seed)
    track = rnd.choice(PL.MUSIC)
    length = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(track)],
                                  capture_output=True, text=True, check=True).stdout)
    start = rnd.uniform(5, max(6, length - total - 5))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-ss", f"{start:.1f}", "-i", str(track), "-t", f"{total}",
                    "-filter_complex", f"[1:a]loudnorm=I=-16:TP=-1.5,afade=t=in:d=1.5,afade=t=out:st={total - 2.5}:d=2.5,aresample=44100[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
                    "-movflags", "+faststart", str(mp4)], check=True)


EXTRA_RAW = "https://raw.githubusercontent.com/bahadirvolkan/hakyol-web/ig-extra"


def due_extra(today):
    """extra.json: hazır videolar (11-20 Cuma gökyüzü reels'i, sky.py), "at" (TSİ) geldiyse bugün henüz paylaşılmamış ilki.
    Video ig-extra dalında. Aynı ayet daha önce kartla paylaşılmış olabilir; tekrar denetimi bugünkü tam açıklamayla."""
    f = HERE / "extra.json"
    if not f.exists():
        return None
    # Yerel zamanlayıcı tam saatte EXTRA_LEAD=20 ile çalışır; Actions zinciri 20 dk sonra yedek olarak yakalar.
    import os
    now = (datetime.now(TSI) + timedelta(minutes=int(os.environ.get("EXTRA_LEAD", 0)))).strftime("%Y-%m-%dT%H:%M")
    done = {c.strip() for c in today}
    return next((x for x in json.loads(f.read_text()) if x["at"][:10] == now[:10] and x["at"] <= now
                 and x["caption"].strip() not in done), None)


def main():
    queue = json.loads((HERE / "queue.json").read_text())
    keys, today = published()
    extra = None  # 11-20: ek videolar ayrı iş (extra.py, tam saatinde); zincir karışmaz
    if extra:
        print("ek video", extra["id"])
        if "--dry" not in sys.argv:
            publish(f"{EXTRA_RAW}/{extra['file']}", extra["caption"], extra["id"], "extra")
        return
    # Tema paketleri (çok kartlı, ~30 sn) 7/7 denemede 5-16 izlenmede kaldı; tek kartlar ~1500. Paket atlanır.
    item = choose(queue, keys, today, datetime.now(TSI).hour)
    if not item:
        print("sıra bitti")
        return
    OUT.mkdir(parents=True, exist_ok=True)
    mp4 = OUT / f"{item['id']}.mp4"
    if item["kind"] == "pack":
        pack_video(item["cards"], mp4, item["id"])
    else:
        jpg = OUT / f"{item['id']}.jpg"
        R.shoot(item["cards"][0], jpg, story=True)
        # Tilavet denemesi (11-15, kullanıcı onayı): ayet kartlarında ney yerine Arapça tilavet;
        # hadis ve dualarda ney kalır (öyle önerildi). Tilavet 60 sn'yi aşarsa ney.
        key = PL.verse_key(item["caption"]) if not any(w in item["caption"] for w in ("Kırk Hadis", "Kur'an'daki dualar")) else None
        audio = PL.recitation(key, OUT / f"{item['id']}-tilavet.mp3") if key else None
        if audio:
            print("tilavet", key, PL.reel_recited(jpg, mp4, audio), "sn")
        else:
            PL.reel(jpg, mp4, secs=PL.secs_for(item["cards"][0]), seed=item["id"])
    print("üretildi", mp4)
    if "--dry" in sys.argv:
        return
    blob = subprocess.run(["git", "hash-object", "-w", str(mp4)], cwd=R.ROOT, capture_output=True, text=True, check=True).stdout.strip()
    tree = subprocess.run(["git", "mktree"], cwd=R.ROOT, input=f"100644 blob {blob}\t{mp4.name}\n", capture_output=True, text=True, check=True).stdout.strip()
    commit = subprocess.run(["git", "commit-tree", tree, "-m", f"media {mp4.name}"], cwd=R.ROOT, capture_output=True, text=True, check=True).stdout.strip()
    subprocess.run(["git", "push", "-fq", "origin", f"{commit}:refs/heads/ig-bulk"], cwd=R.ROOT, check=True)
    publish(f"{RAW}/{mp4.name}", item["caption"], item["id"], item["kind"])


def publish(url, caption, item_id, kind):
    for _ in range(10):  # raw.githubusercontent push'tan hemen sonra 404 verebilir
        try:
            P.urllib.request.urlopen(P.urllib.request.Request(url, method="HEAD"), timeout=20)
            break
        except P.urllib.error.HTTPError:
            time.sleep(15)
    for attempt in range(3):
        c = P.call("POST", f"{P.IG_USER}/media", media_type="REELS", video_url=url, caption=caption)["id"]
        for _ in range(72):
            r = P.call("GET", c, fields="status_code,status")
            if r["status_code"] in ("FINISHED", "ERROR"):
                break
            time.sleep(5)
        if r["status_code"] == "FINISHED":
            P.call("POST", f"{P.IG_USER}/media_publish", creation_id=c)
            print("yayınlandı", item_id, kind)
            try:
                replies.run()
            except (Exception, SystemExit) as e:  # yorum cevabı yayını asla düşürmesin
                print("yorum cevabı hatası:", e)
            return
        print("tekrar", item_id, r.get("status"))
        time.sleep(90)
    sys.exit(f"{item_id} yayınlanamadı")


def arg(name, default):
    return int(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default


if __name__ == "__main__":
    # GitHub saatlik cron'u güvenilmez (çoğu tetik düşüyor); bir çalışma aralıklı birkaç reels atar.
    count, gap = arg("--count", 1), arg("--gap", 0)
    for i in range(count):
        if i:
            time.sleep(gap)
        if 2 <= time.gmtime(time.time() + 3 * 3600).tm_hour < 7:  # TSİ gece: yayın yok
            print("gece, tur bitti")
            break
        main()
