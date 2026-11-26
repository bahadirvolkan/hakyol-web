"""Gökyüzü videolu reels (11-20, kullanıcının uçaktan çektiği görüntüler): video arka plan, yazı satır satır belirir.

    python3 instagram/sky.py SOURCE.MOV START_SN CROP_X AYET_KEY OUT.mp4 [--kicker "Hayırlı Cumalar"]

Kaynak yatay 1920x1080; dikey 608x1080 parça (CROP_X soldan piksel) 1080x1920'ye büyütülür, SPEED kat hızlandırılır (11-20 kullanıcı 3x ile 2x'i izleyip 2x'i seçti).
Lacivert örtü yazıyı okunur kılar. Yazı üç katman (başlık, meal, kaynak + takip) şeffaf PNG, sırayla belirir.
Açıklama OUT.txt'ye yazılır. Kaynak videolar repoda değil: media/bulut/raw (gitignore).
"""
import html
import random
import subprocess
import sys
from pathlib import Path

import render as R
from places import MUSIC

SECS = 10
SPEED = int(__import__("os").environ.get("SKY_SPEED", 2))
LAYER_CSS = """
html,body{width:1080px;height:1920px;background:transparent!important}
body{color:#F5F3EC;font-family:'Manrope',sans-serif;position:relative;text-shadow:0 2px 18px rgba(4,8,20,.75)}
.box{position:absolute;left:90px;right:90px;text-align:center;display:flex;flex-direction:column;align-items:center}
.top{top:420px}
.mid{top:640px;bottom:640px;justify-content:center}
.bot{bottom:330px}
.kicker{font-size:26px}
.title{font-size:92px}
.meal{font-size:58px;font-style:italic}
.ref{font-size:26px;color:#E6E9F0;margin-top:0}
.follow{position:static;margin-top:44px}
.follow div{background:rgba(11,18,32,.55)}
.shade{position:absolute;left:-200px;right:-200px;top:520px;bottom:520px;background:radial-gradient(ellipse at center,rgba(8,14,28,.6) 0%,rgba(8,14,28,.35) 45%,transparent 72%)}
.frame{inset:44px}
"""


def layer(body, png):
    src = R.CACHE / (png.stem + ".html")
    R.CACHE.mkdir(exist_ok=True)
    fit = """<script>document.fonts.ready.then(function(){var m=document.querySelector('.mid');var t=m&&m.firstElementChild;
for(var i=0;t&&i<40&&t.scrollHeight>m.clientHeight;i++){t.style.fontSize=(parseFloat(getComputedStyle(t).fontSize)-2)+'px'}})</script>"""
    src.write_text(f'<!doctype html><meta charset="utf-8"><style>{R.CSS}{LAYER_CSS}</style>{body}{fit}')
    subprocess.run([R.chrome(), "--headless=new", "--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1",
                    "--default-background-color=00000000", "--window-size=1080,1920", "--virtual-time-budget=5000",
                    f"--screenshot={png}", f"file://{src}"], check=True, capture_output=True)


def build(source, start, crop_x, key, mp4, kicker="Hayırlı Cumalar"):
    vs = R.verses(key)
    meal = " ".join(dict.fromkeys(v[1] for v in vs))
    sura, nums = key.split(":")
    ref = f"{R.sura_name(sura)} Suresi {nums.replace('-', '–')}. ayet"
    stem = mp4.stem
    layers = [R.CACHE / f"{stem}-{i}.png" for i in range(3)]
    layer(f'<div class="frame"></div><div class="box top"><div class="kicker">Hakyol</div><div class="title">{html.escape(kicker)}</div></div>', layers[0])
    layer(f'<div class="shade"></div><div class="box mid"><div class="meal">“{html.escape(meal)}”</div></div>', layers[1])
    layer(f'<div class="box bot"><div class="ref">{html.escape(ref)}</div>'
          f'<div class="follow"><div>Günlük ayetler için takip edin.</div></div></div>', layers[2])

    rnd = random.Random(stem)
    track = rnd.choice(MUSIC)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(track)],
                               capture_output=True, text=True, check=True).stdout)
    a_start = rnd.uniform(5, dur - SECS - 5)
    fades = [(0.3, 0.9), (1.4, 1.0), (3.0, 0.9)]  # (başlangıç, süre): başlık, meal, kaynak
    inputs = ["-ss", str(start), "-t", str(SECS * SPEED + 1), "-i", str(source)]
    for p in layers:
        inputs += ["-loop", "1", "-framerate", "30", "-t", str(SECS), "-i", str(p)]
    inputs += ["-ss", f"{a_start:.1f}", "-t", str(SECS), "-i", str(track)]
    fc = (f"[0:v]setpts=(PTS-STARTPTS)/{SPEED},fps=30,crop=608:1080:{crop_x}:0,scale=1080:1920:flags=lanczos,"
          f"drawbox=c=0x0B1220@0.28:t=fill,trim=duration={SECS}[bg];")
    last = "bg"
    for i, (st, d) in enumerate(fades):
        fc += f"[{i + 1}:v]format=rgba,fade=t=in:st={st}:d={d}:alpha=1[l{i}];[{last}][l{i}]overlay=0:0[v{i}];"
        last = f"v{i}"
    fc += (f"[{last}]format=yuv420p[v];"  # 11-22 kullanıcı: sonda karartma yok, arka plan görünsün
           f"[4:a]loudnorm=I=-16:TP=-1.5,afade=t=in:d=1.2,afade=t=out:st={SECS - 1.5}:d=1.5,aresample=44100[a]")
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                    "-t", str(SECS), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "128k",
                    "-movflags", "+faststart", str(mp4)], check=True)
    cap = f"“{meal}”\n({ref}, Diyanet İşleri meali)"
    prefix = f"{kicker}." if kicker else ""
    mp4.with_suffix(".txt").write_text(
        f"{prefix}\n\n{cap}\n\n{R.follow_caption(cap)}\n\n{R.CTA}\n\n{R.TAGS['cuma' if 'Cuma' in kicker else 'ayet']}\n")
    return mp4


# Normal akış (11-20 kullanıcı: kart arka planı yerine gökyüzü videoları): hazır 10 sn'lik dikey arka planlar
# ig-sky dalında (media/bulut/bg.txt ile kesildi, kokpit/silecek/çerçeve görünmeyen bölümler). Kartın kendisi
# (bulk öğesinin gövdesi) üç şeffaf katman olarak üstüne biner: başlık, ayet/meal, kaynak + takip.
SKY_RAW = "https://raw.githubusercontent.com/bahadirvolkan/hakyol-web/ig-sky"
BACKGROUNDS = [f"bg{i:02d}" for i in range(1, 11)]
CARD_CSS = """
html,body{background:transparent!important}.pattern{display:none}
body{text-shadow:0 2px 18px rgba(4,8,20,.8)}
.follow div{background:rgba(11,18,32,.55)}
"""
GROUPS = [
    ".inner>*:not(.kicker):not(.title),.follow,.foot{visibility:hidden}",
    ".frame,.kicker,.title,.ref,.follow,.foot{visibility:hidden}"
    "body:before{content:'';position:absolute;left:-200px;right:-200px;top:380px;bottom:420px;"
    "background:radial-gradient(ellipse at center,rgba(8,14,28,.6) 0%,rgba(8,14,28,.35) 45%,transparent 72%)}",
    ".frame,.inner>*:not(.ref){visibility:hidden}",
]


def card_layers(body, stem):
    R.CACHE.mkdir(exist_ok=True)
    out = []
    for i, g in enumerate(GROUPS):
        src, png = R.CACHE / f"{stem}-k{i}.html", R.CACHE / f"{stem}-k{i}.png"
        src.write_text(R.page(body, story=True).replace("</style>", CARD_CSS + g + "</style>", 1))
        subprocess.run([R.chrome(), "--headless=new", "--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1",
                        "--default-background-color=00000000", "--window-size=1080,1920", "--virtual-time-budget=5000",
                        f"--screenshot={png}", f"file://{src}"], check=True, capture_output=True)
        out.append(png)
    return out


def background(seed, cache):
    """Öğeye göre sabit bir arka plan klibi (indirip önbellekte tutar)."""
    import urllib.request
    import zlib
    name = BACKGROUNDS[zlib.crc32(seed.encode()) % len(BACKGROUNDS)]
    f = cache / f"{name}.mp4"
    if not f.exists():
        cache.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(f"{SKY_RAW}/{name}.mp4", f)
    return f


# 11-22 analizi: ort. izleme 4 sn, 10 sn'lik reels çoğunlukla yarıda bırakılıyordu. Kart reels'i 6 sn; yazı ilk
# kareden ekranda (sırayla belirme yok), sonda karartma yok: sonuna kadar izlenip başa sarması (döngü) için.
CARD_SECS = 6


def compose(bg, layers, mp4, seed, secs=CARD_SECS):
    rnd = random.Random(seed)
    track = rnd.choice(MUSIC)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(track)],
                               capture_output=True, text=True, check=True).stdout)
    a_start = rnd.uniform(5, dur - secs - 5)
    inputs = ["-i", str(bg)]
    for p in layers:
        inputs += ["-loop", "1", "-framerate", "30", "-t", str(secs), "-i", str(p)]
    inputs += ["-ss", f"{a_start:.1f}", "-t", str(secs), "-i", str(track)]
    fc = f"[0:v]drawbox=c=0x0B1220@0.28:t=fill,trim=duration={secs},setpts=PTS-STARTPTS[bg];"
    last = "bg"
    for i in range(len(layers)):
        fc += f"[{last}][{i + 1}:v]overlay=0:0[v{i}];"
        last = f"v{i}"
    a = len(layers) + 1
    fc += (f"[{last}]format=yuv420p[v];"
           f"[{a}:a]loudnorm=I=-16:TP=-1.5,afade=t=in:d=0.4,afade=t=out:st={secs - 0.8}:d=0.8,aresample=44100[a]")
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                    "-t", str(secs), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "128k",
                    "-movflags", "+faststart", str(mp4)], check=True)
    return mp4


def card_reel(body, mp4, seed):
    return compose(background(seed, R.CACHE / "sky"), card_layers(body, mp4.stem), mp4, seed)


# 11-23 test B (kullanıcı onayı): 15-30 sn'lik uzun pasaj (Âyetü'l-Kürsî, İnşirah...). Başlık, kaynak ve davet ilk
# kareden ekranda; meal yazılır gibi harf harf belirir (11-26 kullanıcı: kelime kelime akış takibi zorlaştırıyordu).
# Metin bir kez çizilir, harf konumları tarayıcıda ölçülür; maske harf harf açılır (Pillow, ham kareler ffmpeg'e).
CPS = 16  # saniyede harf (Türkçe sessiz okumanın biraz altında: yazı okunarak takip edilsin)
FLOW_LEAD, FLOW_HOLD = 0.5, 2.6
FLOW_CSS = """
html,body{width:1080px;height:1920px;overflow:hidden}
body{background:transparent!important;color:#F5F3EC;font-family:'Manrope',sans-serif;position:relative;text-shadow:0 2px 18px rgba(4,8,20,.8)}
.box{position:absolute;left:90px;right:90px;text-align:center;display:flex;flex-direction:column;align-items:center}
.top{top:250px}
.title{font-size:84px;margin-top:18px}
.mid{top:520px;bottom:640px;justify-content:center}
.meal{font-size:56px;line-height:1.42;font-style:italic}
.bot{bottom:420px}
.ref{font-size:26px;color:#E6E9F0;margin-top:0}
.follow{position:static;margin-top:28px}
.follow div{background:rgba(11,18,32,.55)}
.shade{position:absolute;left:-200px;right:-200px;top:420px;bottom:560px;background:radial-gradient(ellipse at center,rgba(8,14,28,.62) 0%,rgba(8,14,28,.38) 50%,transparent 76%)}
"""
# Önce sığdır (yazı küçülür), sonra her harfin kutusunu ölç: [[sol, üst, sağ, alt], ...] boşluklar hariç.
FLOW_JS = """<script>document.fonts.ready.then(function(){var m=document.querySelector('.mid'),t=m.firstElementChild;
for(var i=0;i<40&&t.scrollHeight>m.clientHeight;i++){t.style.fontSize=(parseFloat(getComputedStyle(t).fontSize)-2)+'px'}
var n=t.firstChild,r=document.createRange(),out=[];
for(var k=0;k<n.length;k++){if(/\\s/.test(n.data[k]))continue;r.setStart(n,k);r.setEnd(n,k+1);var b=r.getBoundingClientRect();
out.push([Math.floor(b.left),Math.floor(b.top),Math.ceil(b.right),Math.ceil(b.bottom)])}
var p=document.createElement('pre');p.id='rects';p.textContent=JSON.stringify(out);document.body.appendChild(p);p.style.display='none'})</script>"""


def flow_html(title, ref, meal, send, part):
    """part: "base" (meal gizli) ya da "text" (yalnız meal)."""
    head = (f'<div class="shade"></div><div class="box top"><div class="kicker">Hakyol</div>'
            f'<div class="title">{html.escape(title)}</div></div>')
    foot = (f'<div class="box bot"><div class="ref">{html.escape(ref)}</div><div class="follow">'
            f'<p>{html.escape(send)}{R.SEND_SVG}</p><div>Günlük ayetler için takip edin.{R.FOLLOW_SVG}</div></div></div>')
    hide = ".meal{visibility:hidden}" if part == "base" else ".shade,.top,.bot{visibility:hidden}"
    return (f'<!doctype html><meta charset="utf-8"><style>{R.CSS}{FLOW_CSS}{hide}</style>{head}'
            f'<div class="box mid"><div class="meal">“{html.escape(meal)}”</div></div>{foot}{FLOW_JS}')


def flow_layers(title, ref, meal, send, stem):
    import json as J
    import re as RE
    R.CACHE.mkdir(exist_ok=True)
    out = {}
    for part in ("base", "text"):
        src, png = R.CACHE / f"{stem}-{part}.html", R.CACHE / f"{stem}-{part}.png"
        src.write_text(flow_html(title, ref, meal, send, part))
        args = [R.chrome(), "--headless=new", "--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1",
                "--default-background-color=00000000", "--window-size=1080,1920", "--virtual-time-budget=5000"]
        subprocess.run(args + [f"--screenshot={png}", f"file://{src}"], check=True, capture_output=True)
        out[part] = png
        if part == "text":
            dom = subprocess.run(args + ["--dump-dom", f"file://{src}"], check=True, capture_output=True, text=True).stdout
            rects = J.loads(html.unescape(RE.search(r'<pre id="rects"[^>]*>(.*?)</pre>', dom, RE.S).group(1)))
    return out["base"], out["text"], rects


def flow_secs(meal):
    return round(FLOW_LEAD + len(meal.replace(" ", "")) / CPS + FLOW_HOLD, 1)


def flow_reel(title, ref, meal, send, mp4, seed):
    from PIL import Image, ImageDraw
    base, text, rects = flow_layers(title, ref, meal, send, mp4.stem)
    secs = flow_secs(meal)
    txt = Image.open(text).convert("RGBA")
    clear = Image.new("RGBA", txt.size, (0, 0, 0, 0))
    mask = Image.new("L", txt.size, 0)
    draw = ImageDraw.Draw(mask)
    bg = background(seed, R.CACHE / "sky")
    rnd = random.Random(seed)
    track = rnd.choice(MUSIC)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(track)],
                               capture_output=True, text=True, check=True).stdout)
    a_start = rnd.uniform(5, dur - secs - 5)
    # 10 sn'lik gökyüzü klibi yarı hızda (20 sn) ve döngüde: uzun pasajda da arka plan akar.
    fc = (f"[0:v]setpts=2.0*PTS,fps=30,drawbox=c=0x0B1220@0.30:t=fill,trim=duration={secs},setpts=PTS-STARTPTS[bg];"
          f"[bg][1:v]overlay=0:0[b];[b][2:v]overlay=0:0,format=yuv420p[v];"
          f"[3:a]loudnorm=I=-16:TP=-1.5,afade=t=in:d=0.6,afade=t=out:st={secs - 1.2}:d=1.2,aresample=44100[a]")
    proc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-stream_loop", "-1", "-i", str(bg),
                             "-loop", "1", "-framerate", "30", "-t", str(secs), "-i", str(base),
                             "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{txt.size[0]}x{txt.size[1]}", "-r", "30", "-i", "-",
                             "-ss", f"{a_start:.1f}", "-t", str(secs), "-i", str(track),
                             "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-t", str(secs),
                             "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "128k",
                             "-movflags", "+faststart", str(mp4)], stdin=subprocess.PIPE)
    shown, frame = 0, clear.tobytes()
    for f in range(int(secs * 30) + 1):
        want = min(len(rects), max(0, int((f / 30 - FLOW_LEAD) * CPS)))
        if want != shown:
            for left, top, right, bottom in rects[shown:want]:
                draw.rectangle([left - 6, top - 4, right + 3, bottom + 4], fill=255)  # italik taşma payı
            shown = want
            frame = Image.composite(txt, clear, mask).tobytes()
        proc.stdin.write(frame)
    proc.stdin.close()
    if proc.wait():
        raise RuntimeError("ffmpeg akan pasaj")
    return mp4, secs


if __name__ == "__main__":
    a = sys.argv[1:]
    kick = a[a.index("--kicker") + 1] if "--kicker" in a else "Hayırlı Cumalar"
    print(build(Path(a[0]), float(a[1]), int(a[2]), a[3], Path(a[4]), kick))
