"""Cuma sabahı gökyüzü reels'i (11-20/22 kullanıcı kararı): Cuma namazı öncesi yoğun pencere, 07:30-12:30 saat başı
6 reels, 13:00'ten sonra Cuma içeriği yok. Saat başı: 11-20'de 30 dk arayla atılan 5 reels'in 4'ü dağıtım almadı.

    python3 instagram/cuma.py [--dry]

instagram-cuma.yml çalıştırır (instagram-bulk'un sabah işi Cuma 07:00'de tetikler, cron yedek). bulk.py Cuma 07-13
arası kendi sırasını atlar. Ayet her hafta havuzdan sıradaki 6'sı; metin Quran.com Diyanet meali (render.ayet).
Geç başlarsa 25 dk'dan fazla geçmiş saatler atlanır; bugün aynı açıklamayla atılmış olan tekrar atılmaz.
"""
import subprocess
import sys
import time
from datetime import datetime, timedelta

import bulk as B
import publish as P
import render as R
import sky

SLOTS = ["07:30", "08:30", "09:30", "10:30", "11:30", "12:30"]
POOL = ["62:9", "33:56", "2:152", "13:28", "39:53", "10:57",
        "62:10", "2:186", "50:16", "33:41", "21:107", "33:21",
        "9:128", "29:45", "2:153", "7:55", "3:191", "20:14",
        "68:4", "3:31", "33:43", "2:201", "94:5", "2:45"]
BRANCH = "ig-cuma"
RAW = f"https://raw.githubusercontent.com/bahadirvolkan/hakyol-web/{BRANCH}"


def items(d):
    week = (d - datetime(2026, 11, 27).date()).days // 7
    start = (week * len(SLOTS)) % len(POOL)
    keys = [POOL[(start + i) % len(POOL)] for i in range(len(SLOTS))]
    out = []
    for slot, key in zip(SLOTS, keys):
        body, cap = R.ayet(key, "Hayırlı Cumalar")
        caption = f"Hayırlı Cumalar.\n\n{cap}\n\n{R.follow_caption(cap)}\n\n{R.CTA}\n\n{R.TAGS['cuma']}"
        out.append((slot, key, body, caption))
    return out


def main(dry=False):
    now = datetime.now(B.TSI)
    if now.weekday() != 4 and not dry:
        print("Cuma değil")
        return
    _, today = B.published()
    done = {c.strip() for c in today}
    for slot, key, body, caption in items(now.date()):
        at = datetime.combine(now.date(), datetime.strptime(slot, "%H:%M").time(), B.TSI)
        if caption.strip() in done:
            print(slot, key, "bugün atılmış")
            continue
        if datetime.now(B.TSI) > at + timedelta(minutes=25) and not dry:
            print(slot, key, "saati geçti, atlandı")
            continue
        B.OUT.mkdir(parents=True, exist_ok=True)
        mp4 = B.OUT / f"cuma-{now:%Y%m%d}-{slot.replace(':', '')}.mp4"
        sky.card_reel(body, mp4, f"cuma-{key}")
        print("üretildi", slot, key, mp4)
        if dry:
            continue
        blob = subprocess.run(["git", "hash-object", "-w", str(mp4)], cwd=R.ROOT, capture_output=True, text=True, check=True).stdout.strip()
        tree = subprocess.run(["git", "mktree"], cwd=R.ROOT, input=f"100644 blob {blob}\t{mp4.name}\n", capture_output=True, text=True, check=True).stdout.strip()
        commit = subprocess.run(["git", "commit-tree", tree, "-m", f"media {mp4.name}"], cwd=R.ROOT, capture_output=True, text=True, check=True).stdout.strip()
        subprocess.run(["git", "push", "-fq", "origin", f"{commit}:refs/heads/{BRANCH}"], cwd=R.ROOT, check=True)
        wait = (at - datetime.now(B.TSI)).total_seconds()
        if wait > 0:
            print(f"{slot} için {int(wait // 60)} dk bekleniyor")
            time.sleep(wait)
        B.publish(f"{RAW}/{mp4.name}", caption, f"cuma-{key}", "cuma")


if __name__ == "__main__":
    main("--dry" in sys.argv)
