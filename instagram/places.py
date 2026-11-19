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
import urllib.request
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
    """Reels süresi 6-8 sn (11-19 analiz: süre ne olursa olsun ort. izlenme ~4 sn; kısa video = yüksek tamamlanma, döngü)."""
    m = re.search(r'class="meal"[^>]*>(.*?)</div>', body, re.S)
    n = len(re.sub(r"<[^>]+>", "", m.group(1))) if m else 300
    return max(6, min(8, round(5 + n / 100)))


RECITER = "https://everyayah.com/data/Alafasy_128kbps"  # Mişari Raşid el-Afasi (Quran.com tilavet 7)
MAX_RECITATION = 7  # 11-19: yalnız kısa ayetler tilavetli (reels 6-9 sn); uzunlar kısa ney


def verse_key(caption):
    """Açıklamadaki '(Bakara Suresi 186. ayet)' -> '2:186'; ayet yoksa (hadis) None."""
    # Yalnız ilk paragraf: alttaki takip cümlesinde de bir ayet atfı (Ra'd 28) var.
    # Sabah/dua açıklamalarında ilk paragraf "Hayırlı sabahlar…" ya da "Kur'an'daki dualar." olur: atlanır.
    paras = [p for p in caption.split("\n\n") if not p.startswith(("Hayırlı sabahlar", "Kur'an'daki dualar"))]
    m = re.search(r"\(([^()]+?) Suresi (\d+)(?:[–-](\d+))?\. ayet[,)]", paras[0] if paras else "")
    if not m:
        return None
    names = {c["translated_name"]["name"]: c["id"] for c in R.cached("chapters_tr.json", "https://api.quran.com/api/v4/chapters?language=tr")["chapters"]}
    sura = names.get(m.group(1))
    return f"{sura}:{m.group(2)}" + (f"-{m.group(3)}" if m.group(3) else "") if sura else None


def duration(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)],
                                capture_output=True, text=True, check=True).stdout)


def recitation(key, out):
    """Ayetin Arapça tilaveti (müziksiz). Çok ayetliyse uç uca. Çok uzunsa None (ney'e düşülür)."""
    sura, rng = key.split(":")
    a, _, b = rng.partition("-")
    parts = []
    for n in range(int(a), int(b or a) + 1):
        f = out.parent / f"tilavet-{int(sura):03d}{n:03d}.mp3"
        if not f.exists():
            req = urllib.request.Request(f"{RECITER}/{int(sura):03d}{n:03d}.mp3", headers={"User-Agent": "hakyol.app"})
            f.write_bytes(urllib.request.urlopen(req, timeout=60).read())
        parts.append(f)
    if len(parts) > 1:
        lst = out.with_suffix(".txt")
        lst.write_text("".join(f"file '{x}'\n" for x in parts))
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c:a", "libmp3lame", "-q:a", "2", str(out)], check=True)
    else:
        out.write_bytes(parts[0].read_bytes())
    return out if duration(out) <= MAX_RECITATION else None


def reel_recited(jpg, mp4, audio):
    """Kart + tilavet: süre tilavet kadar (+0.5 sn baş, +1 sn son), yavaş yakınlaşma, müzik yok."""
    secs = max(6, round(duration(audio) + 1.5))
    frames = secs * 30
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", "30", "-i", str(jpg), "-i", str(audio), "-t", str(secs),
        "-filter_complex",
        f"[0:v]scale=1620:-1,zoompan=z='1+0.05*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        f":d={frames}:s=1080x1920:fps=30,format=yuv420p[v];"
        f"[1:a]adelay=500|500,apad,loudnorm=I=-16:TP=-1.5,aresample=44100[a]",
        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(mp4),
    ], check=True)
    return secs


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
