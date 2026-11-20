"""Gökyüzü videolu reels (11-20, kullanıcının uçaktan çektiği görüntüler): video arka plan, yazı satır satır belirir.

    python3 instagram/sky.py SOURCE.MOV START_SN CROP_X AYET_KEY OUT.mp4 [--kicker "Hayırlı Cumalar"]

Kaynak yatay 1920x1080; dikey 608x1080 parça (CROP_X soldan piksel) 1080x1920'ye büyütülür, SPEED kat hızlandırılır (11-20 kullanıcı: hareket belli olsun, 3x).
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
SPEED = 3
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
    fc += (f"[{last}]fade=t=in:d=0.4,fade=t=out:st={SECS - 0.6}:d=0.6,format=yuv420p[v];"
           f"[4:a]loudnorm=I=-16:TP=-1.5,afade=t=in:d=1.2,afade=t=out:st={SECS - 1.5}:d=1.5,aresample=44100[a]")
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                    "-t", str(SECS), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "128k",
                    "-movflags", "+faststart", str(mp4)], check=True)
    cap = f"“{meal}”\n({ref}, Diyanet İşleri meali)"
    prefix = f"{kicker}." if kicker else ""
    mp4.with_suffix(".txt").write_text(
        f"{prefix}\n\n{cap}\n\n{R.follow_caption(cap)}\n\n{R.CTA}\n\n{R.TAGS['cuma' if 'Cuma' in kicker else 'ayet']}\n")
    return mp4


if __name__ == "__main__":
    a = sys.argv[1:]
    kick = a[a.index("--kicker") + 1] if "--kicker" in a else "Hayırlı Cumalar"
    print(build(Path(a[0]), float(a[1]), int(a[2]), a[3], Path(a[4]), kick))
