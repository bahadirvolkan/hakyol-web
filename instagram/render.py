"""Hakyol Instagram günlük gönderisi: görsel (1080x1350 JPEG) + açıklama.

    python3 instagram/render.py [YYYY-AA-GG]     # varsayılan: bugün (TSİ)
    python3 instagram/render.py --all-verses     # ayet listesindeki her kartı önizle (taşma kontrolü)

    python3 instagram/render.py [YYYY-AA-GG] --story N   # N=0..3, 1080x1920 hikâye

Çıktı: ig/<tarih>.mp4 + .txt (reels), ig/<tarih>-s<N>.mp4 (hikâye); fon müzikli, bkz. places.reel. ig/ commit'lenmez;
workflow görseli tek dosyalık ig-daily dalına itip raw.githubusercontent üzerinden
Instagram'a verir (bkz. instagram/publish.py ve .github/workflows/instagram.yml).

Takvim durumsuz: gönderi türü haftanın gününden, sıradaki ayet/şehir START'tan bu yana
geçen gün sayısından çıkar. Cuma: Cuma mesajı; Salı/Perşembe/Pazar: şehir vakitleri;
Pazartesi/Çarşamba/Cumartesi: günün ayeti.

Ayet metni her zaman Quran.com'dan çekilir (meal 77 = Diyanet İşleri, Arapça Uthmani),
elle yazılmaz: dini içerikte yanlış alıntı riski. Kaynağı belli olmayan hadis kullanılmaz.
"""
import html
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HERE = ROOT / "instagram"
OUT = ROOT / "ig"
CACHE = HERE / ".cache"
START = date(2026, 11, 12)
# 11-11/12 toplu paylaşımlar VERSES[0:27]'yi kullandı; 11-14'ten itibaren her gün (Cuma hariç)
# günün ayeti bunlardan sonra devam etsin, ilk haftalarda aynı ayet ızgarada tekrar görünmesin.
AYET_START = date(2026, 11, 14)
VERSE_OFFSET = 27

# Bilinen, tek başına anlamı tam ayetler/ayet grupları. Sıra döner.
VERSES = [
    "94:5-6", "13:28", "2:152", "2:186", "39:53", "2:153", "4:103", "3:173",
    "14:7", "2:45", "29:45", "93:3-5", "2:201", "17:78", "49:10", "3:139", "40:60", "20:14",
    "51:56", "3:8", "33:41-42", "7:23", "103:1-3", "2:238", "21:87", "25:74", "112:1-4", "29:69",
    "11:114", "3:200", "49:13", "14:40-41", "7:55", "18:10", "67:1-2", "94:7-8", "17:80",
]
CUMA_VERSES = ["62:9", "62:10", "33:56", "2:152", "13:28", "39:53"]
# (Diyanet il adı, görünen ad, şehir sayfası yolu)
CITIES = [
    ("İSTANBUL", "İstanbul", "istanbul"), ("ANKARA", "Ankara", "ankara"), ("İZMİR", "İzmir", "izmir"),
    ("BURSA", "Bursa", "bursa"), ("KONYA", "Konya", "konya"), ("ANTALYA", "Antalya", "antalya"),
    ("GAZİANTEP", "Gaziantep", "gaziantep"), ("ŞANLIURFA", "Şanlıurfa", "sanliurfa"), ("KOCAELİ", "Kocaeli", "kocaeli"),
    ("ADANA", "Adana", "adana"), ("MERSİN", "Mersin", "mersin"), ("DİYARBAKIR", "Diyarbakır", "diyarbakir"),
    ("KAYSERİ", "Kayseri", "kayseri"), ("HATAY", "Hatay", "hatay"), ("SAMSUN", "Samsun", "samsun"),
    ("ESKİŞEHİR", "Eskişehir", "eskisehir"), ("ERZURUM", "Erzurum", "erzurum"), ("TRABZON", "Trabzon", "trabzon"),
    ("SAKARYA", "Sakarya", "sakarya"), ("MALATYA", "Malatya", "malatya"), ("DENİZLİ", "Denizli", "denizli"),
    ("MANİSA", "Manisa", "manisa"), ("KAHRAMANMARAŞ", "Kahramanmaraş", "kahramanmaras"), ("VAN", "Van", "van"),
    ("BALIKESİR", "Balıkesir", "balikesir"), ("SİVAS", "Sivas", "sivas"), ("ELAZIĞ", "Elazığ", "elazig"),
    ("TEKİRDAĞ", "Tekirdağ", "tekirdag"), ("MARDİN", "Mardin", "mardin"), ("ORDU", "Ordu", "ordu"),
]

MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
CTA = "Vakit girince ezan sesiyle haber veren uygulama Hakyol: ücretsiz, üyelik yok. İndirme linki profilde."
TAGS = {
    "ayet": "#ayet #kuran #kuranıkerim #gününayeti #dua #islam #müslüman #hakyol",
    "cuma": "#hayırlıcumalar #cumamesajları #cuma #ayet #kuran #dua #islam #hakyol",
}


def tr_date(d):
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}, {DAYS[d.weekday()]}"


def get(url):
    # Quran.com varsayılan urllib User-Agent'ına 403 veriyor.
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 hakyol.app"})
    return urllib.request.urlopen(req, timeout=20).read().decode()


def cached(name, url):
    f = CACHE / name
    if not f.exists():
        CACHE.mkdir(exist_ok=True)
        f.write_text(get(url))
    return json.loads(f.read_text())


def verses(key):
    """'94:5-6' -> [(arapça, meal), ...]"""
    sura, rng = key.split(":")
    a, _, b = rng.partition("-")
    out = []
    for n in range(int(a), int(b or a) + 1):
        v = cached(f"{sura}_{n}.json", f"https://api.quran.com/api/v4/verses/by_key/{sura}:{n}?translations=77&fields=text_uthmani")["verse"]
        meal = re.sub(r"<sup.*?</sup>|<[^>]+>", "", v["translations"][0]["text"])
        out.append((v["text_uthmani"], ilah(html.unescape(meal).strip())))
    return out


# Quran.com'daki Diyanet meali bazı ayetlerde "tanrı" der (ör. Tâhâ 14); güncel Diyanet meali
# ve takipçiler "ilah" bekliyor (11-13 şikâyet). Ekler ünlü/ünsüz uyumuna göre çevrilir.
ILAH_EKLERI = {"": "", "yı": "ı", "ya": "a", "nın": "ın", "sı": "ı", "dan": "tan", "da": "ta", "yla": "la",
               "lar": "lar", "ları": "ları", "lara": "lara", "ların": "ların", "lardan": "lardan", "larda": "larda"}


def ilah(text):
    def sub(m):
        root, ek = m.group(1), m.group(2)
        if ek not in ILAH_EKLERI:
            raise ValueError(f"'{m.group(0)}' için ilah karşılığı tanımlı değil")
        return ("İlah" if root[0] == "T" else "ilah") + ILAH_EKLERI[ek]
    return re.sub(r"\b([Tt]anrı)([a-zçğıöşü]*)", sub, text)


def sura_name(sura):
    return cached("chapters_tr.json", "https://api.quran.com/api/v4/chapters?language=tr")["chapters"][int(sura) - 1]["translated_name"]["name"]


def font(name, file, weight=""):
    return f"@font-face{{font-family:'{name}';{weight}src:url(file://{file})}}"


CSS = (
    font("Playfair Display", ROOT / "fonts/playfair-display-latin-ext-wght-normal.woff2", "font-weight:400 900;")
    + font("Playfair Display", ROOT / "fonts/playfair-display-latin-wght-normal.woff2", "font-weight:400 900;unicode-range:U+0000-00FF;")
    + font("Manrope", ROOT / "fonts/manrope-latin-ext-wght-normal.woff2", "font-weight:200 800;")
    + font("Manrope", ROOT / "fonts/manrope-latin-wght-normal.woff2", "font-weight:200 800;unicode-range:U+0000-00FF;")
    + font("Amiri Quran", HERE / "fonts/AmiriQuran.ttf")
    + """
*{margin:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{background:radial-gradient(ellipse at 50% 0%,#1A2742 0%,#0B1220 55%,#070C16 100%);color:#F5F3EC;font-family:'Manrope',sans-serif;position:relative}
.pattern{position:absolute;inset:0;opacity:.07;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23D4AF37' stroke-width='1.2'%3E%3Cpath d='M60 6l15 39 39 15-39 15-15 39-15-39L6 60l39-15z'/%3E%3Crect x='32' y='32' width='56' height='56' transform='rotate(45 60 60)'/%3E%3C/g%3E%3C/svg%3E")}
.frame{position:absolute;inset:44px;border:2px solid rgba(212,175,55,.45);border-radius:36px}
.frame:after{content:'';position:absolute;inset:12px;border:1px solid rgba(212,175,55,.18);border-radius:28px}
.wrap{position:absolute;inset:44px;padding:70px 90px 150px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
.kicker{font-size:24px;letter-spacing:.32em;color:#D4AF37;font-weight:700;text-transform:uppercase}
.title{font-family:'Playfair Display',serif;font-size:76px;font-weight:700;color:#F2D58C;line-height:1.1;margin-top:26px}
.rule{width:120px;height:2px;flex-shrink:0;background:linear-gradient(90deg,transparent,#D4AF37,transparent);margin:40px auto}
.ar{font-family:'Amiri Quran',serif;direction:rtl;font-size:52px;line-height:1.9}
.meal{font-family:'Playfair Display',serif;font-size:54px;line-height:1.45;font-style:italic}
.ref{margin-top:34px;font-size:24px;letter-spacing:.12em;color:#C9CEDA}
.foot{position:absolute;left:0;right:0;bottom:78px;display:flex;align-items:center;justify-content:center;gap:16px;font-size:26px;font-weight:700;color:#F2D58C;letter-spacing:.04em}
.foot img{width:52px;height:52px;border-radius:13px}
.foot span{color:#7C8AA3;font-weight:500}
table{width:100%;border-collapse:collapse;margin-top:8px}
td{padding:22px 10px;border-bottom:1px solid rgba(212,175,55,.18);font-size:40px}
td:first-child{text-align:left;color:#C9CEDA}
td:last-child{text-align:right;font-family:'Playfair Display',serif;font-weight:700;font-size:48px}
tr:last-child td{border-bottom:0}
"""
)

# Uzun ayetlerde yazıyı içerik çerçeveye sığana kadar küçült (önce meal, sonra Arapça).
FIT_JS = """<script>
document.fonts.ready.then(function(){
  var w=document.querySelector('.wrap'),m=document.querySelector('.meal'),a=document.querySelector('.ar');
  function over(){return w.scrollHeight>w.clientHeight+1}
  for(var i=0;i<60&&over();i++){
    if(m&&parseFloat(getComputedStyle(m).fontSize)>30)m.style.fontSize=(parseFloat(getComputedStyle(m).fontSize)-2)+'px';
    if(a&&parseFloat(getComputedStyle(a).fontSize)>32)a.style.fontSize=(parseFloat(getComputedStyle(a).fontSize)-2)+'px';
  }
  if(over()&&a)a.remove();
  document.body.setAttribute('data-done','1');
});
</script>"""


# Hikâye 9:16; üst ve alttaki Instagram arayüzü (profil satırı, yanıt kutusu) içeriği örtmesin.
STORY_CSS = """
html,body{height:1920px}
.wrap{padding:300px 90px 420px}
.foot{bottom:330px}
"""


def page(body, story=False):
    foot = f'<div class="foot"><img src="file://{ROOT / "icon.png"}"> hakyol.app <span>· ücretsiz</span></div>'
    css = CSS + (STORY_CSS if story else "")
    return f'<!doctype html><meta charset="utf-8"><style>{css}</style><div class="pattern"></div><div class="frame"></div><div class="wrap">{body}</div>{foot}{FIT_JS}'


def ayet(key, kicker, title=None):
    vs = verses(key)
    ar = " ".join(v[0] for v in vs)
    meal = " ".join(v[1] for v in vs)
    sura, nums = key.split(":")
    ref = f"{sura_name(sura)} Suresi {nums.replace('-', '–')}. ayet"
    body = (
        f'<div class="kicker">{html.escape(kicker)}</div>'
        + (f'<div class="title">{html.escape(title)}</div>' if title else "")
        + f'<div class="rule"></div><div class="ar">{ar}</div><div class="rule"></div>'
        f'<div class="meal">“{html.escape(meal)}”</div><div class="ref">{html.escape(ref)}</div>'
    )
    return body, f"“{meal}”\n({ref}, Diyanet İşleri meali)"


def vakit(d, n):
    """n. sıradaki büyük ilin kartı: (gövde, etiketli açıklama) ya da None."""
    import places
    return places.card(d, places.il(CITIES[n % len(CITIES)][2]))


def ilce_vakit(d, n):
    """Nüfusça büyük ilçeler sırayla (11-12 toplu paylaşım ilk 69'u kullandı)."""
    import places
    big = sorted(((x, i) for x in places.PLACES for i in x["ilceler"]), key=lambda p: -p[1]["nufus"])
    il, ilce = big[(69 + n) % len(big)]
    return places.card(d, il, ilce)


def count_days(d, weekdays):
    """START'tan d'ye (d hariç) kadar haftanın bu günlerine düşen gün sayısı: listede sıra."""
    return sum(1 for i in range((d - START).days) if (START + timedelta(days=i)).weekday() in weekdays)


def post_for(d):
    """Günün reels'i her zaman ayet (11-13 karar: vakit kartları reels'te değil hikâyede); Cuma'da Cuma mesajı."""
    if d.weekday() == 4:
        key = CUMA_VERSES[count_days(d, {4}) % len(CUMA_VERSES)]
        body, cap = ayet(key, tr_date(d), "Hayırlı Cumalar")
        return body, f"Hayırlı Cumalar.\n\n{cap}\n\n{CTA}\n\n{TAGS['cuma']}"
    n = sum(1 for i in range((d - AYET_START).days) if (AYET_START + timedelta(days=i)).weekday() != 4)
    key = VERSES[(VERSE_OFFSET + n) % len(VERSES)]
    body, cap = ayet(key, "Günün Ayeti")
    return body, f"{cap}\n\n{CTA}\n\n{TAGS['ayet']}"


def story_for(d, slot):
    """Günde 4 hikâye: 0 günün reels'i, 1 büyük bir ilin vakitleri, 2-3 büyük ilçelerin vakitleri."""
    n = (d - START).days
    r = None
    if slot == 1:
        r = vakit(d, n)
    elif slot in (2, 3):
        r = ilce_vakit(d, 2 * n + slot - 2)
    return r[0] if r else post_for(d)[0]


def chrome():
    for c in (os.environ.get("CHROME"), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              shutil.which("google-chrome"), shutil.which("chromium")):
        if c and Path(c).exists():
            return c
    sys.exit("Chrome bulunamadı")


def shoot(body, jpg, story=False):
    CACHE.mkdir(exist_ok=True)
    src = CACHE / (jpg.stem + ".html")
    png = CACHE / (jpg.stem + ".png")
    src.write_text(page(body, story))
    subprocess.run([chrome(), "--headless=new", "--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--window-size=1080,{1920 if story else 1350}", "--virtual-time-budget=5000", f"--screenshot={png}", f"file://{src}"],
                   check=True, capture_output=True)
    # Instagram API yalnız JPEG kabul ediyor.
    try:
        from PIL import Image
        Image.open(png).convert("RGB").save(jpg, quality=92)
    except ImportError:
        subprocess.run(["magick", png, "-quality", "92", jpg], check=True)


def main():
    OUT.mkdir(exist_ok=True)
    if "--all-verses" in sys.argv:
        prev = CACHE / "preview"
        prev.mkdir(parents=True, exist_ok=True)
        for k in VERSES + CUMA_VERSES:
            shoot(ayet(k, "Günün Ayeti")[0], prev / f"{k.replace(':', '_')}.jpg")
        print(prev)
        return
    tr_now = datetime.now(timezone(timedelta(hours=3)))
    args = [a for a in sys.argv[1:] if re.fullmatch(r"\d{4}-\d\d-\d\d", a)]
    d = date.fromisoformat(args[0]) if args else tr_now.date()
    import places

    # Her paylaşım müzikli dikey video: gönderi reels (ızgarada da görünür), hikâye video.
    if "--story" in sys.argv:
        slot = int(sys.argv[sys.argv.index("--story") + 1])
        name, body, secs = f"{d}-s{slot}", story_for(d, slot), 12
    else:
        body, cap = post_for(d)
        name, secs = f"{d}", 15
        (OUT / f"{name}.txt").write_text(cap + "\n")
    shoot(body, OUT / f"{name}.jpg", story=True)
    places.reel(OUT / f"{name}.jpg", OUT / f"{name}.mp4", secs=secs)
    print(name, OUT / f"{name}.mp4")


if __name__ == "__main__":
    main()
