"""İl/ilçe vakit kartları, yerel etiketler ve müzikli reels videosu.

places.json build-cities.js'ten gelir (sitedeki il/ilçe eşleştirmesinin aynısı + nüfus).
Etiketler: yerin kendi adı ve vakit etiketleri, ilin büyük ilçeleri (nüfusa göre), genel
etiketler; Instagram sınırı 30.
"""
import html
import json
import random
import re
import subprocess
from datetime import date
from pathlib import Path

import render as R

HERE = Path(__file__).resolve().parent
PLACES = json.loads((HERE / "places.json").read_text())
# Kullanıcının seçtiği Pixabay parçaları (11-12); Desert Sunrise Ney favori, iki kat sık çalar.
MUSIC = sorted((HERE / "music").glob("*.mp3"))
MUSIC += [m for m in MUSIC if m.stem == "desert-sunrise-ney"]
GENERIC = ["#namazvakitleri", "#ezanvakti", "#namaz", "#ezan", "#islam", "#hakyol"]
ASCII = str.maketrans("çğıöşüâîû", "cgiosuaiu")
NAMES = ["İmsak", "Güneş", "Öğle", "İkindi", "Akşam", "Yatsı"]


def il(slug):
    return next(x for x in PLACES if x["slug"] == slug)


def word(name):
    return re.sub(r"[^0-9a-zçğıöşüâîû]", "", name.replace("I", "ı").replace("İ", "i").lower())


def tags(il_rec, ilce=None):
    out = []

    def add(*ts):
        for t in ts:
            if t not in out and len(out) < 30:
                out.append(t)

    for place in ([ilce] if ilce else []) + [il_rec]:
        w = word(place["name"])
        add(f"#{w}", f"#{w}namazvakitleri", f"#{w}ezanvakti")
        if w.translate(ASCII) != w:
            add(f"#{w.translate(ASCII)}")
    add(f"#{word(il_rec['name'])}ezanvakitleri", f"#{word(il_rec['name'])}namazvakti")
    big = sorted(il_rec["ilceler"], key=lambda x: -x["nufus"])
    room = 30 - len(out) - len(GENERIC)
    for x in big[: max(room, 0)]:
        add(f"#{word(x['name'])}")
    add(*GENERIC)
    return " ".join(out)


def card(d, il_rec, ilce=None):
    """(gövde, açıklama) ya da o gün veri yoksa None."""
    pid = ilce["id"] if ilce else il_rec["centerId"]
    rows = json.loads((R.ROOT / "data/vakitler.json").read_text())["ilce"].get(pid, [])
    row = next((r for r in rows if r[0] == d.isoformat()), None)
    if not row:
        return None
    name = ilce["name"] if ilce else il_rec["name"]
    sub = f"{il_rec['name']} · {row[8]}" if ilce else row[8]
    trs = "".join(f"<tr><td>{a}</td><td>{b}</td></tr>" for a, b in zip(NAMES, row[1:7]))
    body = (
        f'<div class="kicker">{R.tr_date(d)}</div><div class="title">{html.escape(name)}<br>Namaz Vakitleri</div>'
        f'<div class="ref" style="margin-top:20px">{html.escape(sub)}</div>'
        f'<div class="rule" style="margin:30px auto 10px"></div><table>{trs}</table>'
    )
    times = "\n".join(f"{a}: {b}" for a, b in zip(NAMES, row[1:7]))
    where = f"{name}, {il_rec['name']}" if ilce else name
    note = (f"\nDiyanet {name} için ayrı vakit yayımlamaz; {il_rec['name']} merkez vakitleri geçerlidir."
            if ilce and ilce["viaCenter"] else "")
    url = f"hakyol.app/namaz-vakitleri/{il_rec['slug']}/" + (f"{ilce['slug']}/" if ilce else "")
    cap = (f"{where} namaz vakitleri, {R.tr_date(d)}\n\n{times}{note}\n\nKaynak: Diyanet İşleri Başkanlığı. "
           f"30 günlük vakitler: {url}\n\n{R.CTA}\n\n{tags(il_rec, ilce)}")
    return body, cap


def secs_for(body):
    """Reels süresi meal uzunluğuna göre 8-15 sn: kısa ayet sonuna kadar izlensin (ort. izlenme ~4 sn, 11-14)."""
    m = re.search(r'class="meal"[^>]*>(.*?)</div>', body, re.S)
    n = len(re.sub(r"<[^>]+>", "", m.group(1))) if m else 300
    return max(8, min(15, round(4 + n / 22)))


def reel(jpg, mp4, secs=15, seed=None):
    """Durağan kartı yavaş yakınlaşan, fon müzikli dikey videoya çevirir (Instagram sessiz içerik istemiyoruz)."""
    rnd = random.Random(seed if seed is not None else jpg.name)
    track = rnd.choice(MUSIC)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(track)],
                               capture_output=True, text=True, check=True).stdout)
    start = rnd.uniform(5, dur - secs - 5)
    frames = secs * 30
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", "30", "-i", str(jpg),
        "-ss", f"{start:.1f}", "-i", str(track), "-t", str(secs),
        "-filter_complex",
        f"[0:v]scale=1620:-1,zoompan=z='1+0.05*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        f":d={frames}:s=1080x1920:fps=30,format=yuv420p[v];"
        f"[1:a]loudnorm=I=-16:TP=-1.5,afade=t=in:d=1.5,afade=t=out:st={secs - 2}:d=2,aresample=44100[a]",
        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(mp4),
    ], check=True)
