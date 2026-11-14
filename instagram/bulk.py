"""queue.json'daki sıradaki reels'i üretip yayınlar (saat başı workflow: instagram-bulk.yml).

    IG_TOKEN=... python3 instagram/bulk.py [--dry] [--count N --gap SANİYE]

Durumsuz: son ~300 gönderinin açıklamasına bakar, henüz paylaşılmamış ilk öğeyi seçer.
Tekli öğe: places.reel (yavaş yakınlaşma, meal uzunluğuna göre 8-15 sn). Paket: kart başına kısa klipler, geçişli,
tek fon müziği. Video tek dosyalık ig-bulk dalına itilir (raw URL).
"""
import random
import subprocess
import sys
import time
from pathlib import Path

import places as PL
import publish as P
import render as R
import replies
import json

HERE = Path(__file__).resolve().parent
OUT = R.OUT / "bulk"
RAW = "https://raw.githubusercontent.com/bahadirvolkan/hakyol-web/ig-bulk"


def published_captions():
    caps, params = set(), {"fields": "caption", "limit": 100}
    for _ in range(3):
        page = P.call("GET", f"{P.IG_USER}/media", **params)
        caps |= {(m.get("caption") or "").strip() for m in page["data"]}
        after = page.get("paging", {}).get("cursors", {}).get("after")
        if not page.get("paging", {}).get("next") or not after:
            break
        params["after"] = after
    return caps


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


def main():
    queue = json.loads((HERE / "queue.json").read_text())
    done = published_captions()
    # Tema paketleri (çok kartlı, ~30 sn) 7/7 denemede 5-16 izlenmede kaldı; tek kartlar ~1500. Paket atlanır.
    item = next((q for q in queue if q["kind"] != "pack" and q["caption"].strip() not in done), None)
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
        PL.reel(jpg, mp4, secs=PL.secs_for(item["cards"][0]), seed=item["id"])
    print("üretildi", mp4)
    if "--dry" in sys.argv:
        return
    blob = subprocess.run(["git", "hash-object", "-w", str(mp4)], cwd=R.ROOT, capture_output=True, text=True, check=True).stdout.strip()
    tree = subprocess.run(["git", "mktree"], cwd=R.ROOT, input=f"100644 blob {blob}\t{mp4.name}\n", capture_output=True, text=True, check=True).stdout.strip()
    commit = subprocess.run(["git", "commit-tree", tree, "-m", f"media {mp4.name}"], cwd=R.ROOT, capture_output=True, text=True, check=True).stdout.strip()
    subprocess.run(["git", "push", "-fq", "origin", f"{commit}:refs/heads/ig-bulk"], cwd=R.ROOT, check=True)
    url = f"{RAW}/{mp4.name}"
    for _ in range(10):  # raw.githubusercontent push'tan hemen sonra 404 verebilir
        try:
            P.urllib.request.urlopen(P.urllib.request.Request(url, method="HEAD"), timeout=20)
            break
        except P.urllib.error.HTTPError:
            time.sleep(15)
    for attempt in range(3):
        c = P.call("POST", f"{P.IG_USER}/media", media_type="REELS", video_url=url, caption=item["caption"])["id"]
        for _ in range(72):
            r = P.call("GET", c, fields="status_code,status")
            if r["status_code"] in ("FINISHED", "ERROR"):
                break
            time.sleep(5)
        if r["status_code"] == "FINISHED":
            P.call("POST", f"{P.IG_USER}/media_publish", creation_id=c)
            print("yayınlandı", item["id"], item["kind"])
            try:
                replies.run()
            except Exception as e:  # yorum cevabı yayını asla düşürmesin
                print("yorum cevabı hatası:", e)
            return
        print("tekrar", item["id"], r.get("status"))
        time.sleep(90)
    sys.exit(f"{item['id']} yayınlanamadı")


def arg(name, default):
    return int(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default


if __name__ == "__main__":
    # GitHub saatlik cron'u güvenilmez (çoğu tetik düşüyor); bir çalışma aralıklı birkaç reels atar.
    count, gap = arg("--count", 1), arg("--gap", 0)
    for i in range(count):
        if i:
            time.sleep(gap)
        main()
