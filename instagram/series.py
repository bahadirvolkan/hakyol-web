"""Toplu reels sırası (instagram/queue.json): tema paketleri, Kur'an duaları, tek ayetler, Kırk Hadis.

    python3 instagram/series.py      # ağ gerekir (Quran.com, hadith-api); sonucu commit'le

Ayetler elle yazılmaz: anahtar listesi buradadır, metin Quran.com'dan (Diyanet meali) gelir ve
her ayet temasının anahtar kelimesini içermiyorsa ELENİR (yanlış ayet numarası sızmasın).
Hadisler hadith-api tur-nawawi'den; kartta yalnız Peygamberimizin sözü ve "(Hadis-i Şerif)"
(derleyen adı yazılmaz). Sırayı bulk.py saat başı birer birer yayınlar.
"""
import json
import re
import urllib.request
from pathlib import Path

import render as R

HERE = Path(__file__).resolve().parent
MAX_MEAL = 420

# (başlık, alt başlık (kullanılmıyor), doğrulama deseni, ayetler)
# 11-19 analiz: zikir/tesbih, dua/rahmet, sabır, tevekkül ayetleri en çok beğeni ve kayıt aldı; hukuk ve kıssa
# ayetleri (65:4 iddet, 11:61 Semud, 31:12 Lokman, 2:83, 2:185 gibi) en zayıftı: çıkarıldı. Paket üretilmez.
THEMES = [
    ("Sabredenlere Müjde", "", r"sab[ıi]r|sabr", ["2:153", "2:155", "2:156", "3:200", "39:10", "16:127", "11:115", "8:46", "3:146", "103:3", "40:55", "16:96", "42:43", "31:17", "70:5", "46:35", "76:12", "13:24", "28:54", "23:111", "25:75"]),
    ("Allah'ın Rahmetinden Ümit Kesmeyin", "", r"rahmet|ümit|bağışla", ["39:53", "7:156", "12:87", "15:56", "6:54", "4:110", "15:49", "7:56", "6:12", "21:107", "24:22", "42:25", "73:20", "4:110"]),
    ("Tövbe Kapısı Açık", "", r"tövbe|tevbe|bağışla|mağfiret", ["66:8", "3:135", "25:70", "11:3", "71:10", "3:133", "4:17", "24:31", "20:82", "9:104", "40:3"]),
    ("Namazı Dosdoğru Kılın", "", r"namaz", ["2:45", "2:238", "20:14", "29:45", "23:2", "14:31", "4:103", "2:43", "2:110", "22:41", "24:56", "70:23"]),
    ("Şükrederseniz Artırırım", "", r"ş[uü]k", ["14:7", "2:152", "16:114", "2:172", "39:66", "27:40", "14:34", "16:18", "76:3", "7:10", "16:78", "23:78", "67:23", "4:147"]),
    ("Allah'a Tevekkül Edin", "", r"tevekkül|güven|yeter", ["3:159", "65:3", "3:173", "8:2", "9:51", "33:3", "14:12", "25:58", "11:123", "26:217", "42:36", "29:59", "16:42", "64:13", "67:29"]),
    ("Anne Babaya İyilik", "", r"anne|baba|ana ", ["17:23", "17:24", "31:14", "29:8", "4:36", "46:15"]),
    ("Kalpler Huzur Bulur", "", r"kalb|kalp|gönül|huzur|sükûnet|yatış|güven", ["13:28", "48:4", "89:27", "89:28", "57:16", "26:89", "50:33", "39:23", "22:46"]),
    ("Dünya Hayatı Geçicidir", "", r"dünya|ahiret", ["57:20", "3:185", "29:64", "87:16", "87:17", "6:32", "18:46", "40:39", "4:77", "10:24", "28:60", "93:4"]),
    ("Allah Size Yakındır", "", r"yakın|dua|beraber|icabet|cevap|karşılık veren", ["2:186", "50:16", "40:60", "57:4", "27:62", "2:115", "58:7", "56:85", "42:19"]),
    ("Zorlukla Beraber Kolaylık", "", r"kolay|güç|zorluk|gücünün", ["94:5", "94:6", "65:7", "2:286", "93:3", "4:28", "5:6", "87:8", "92:7"]),
    # 11-22: havuz tükendi; okunup elenenler: hukuk (2:222, 6:151, 2:200), kıssa (12:67, 34:13, 28:21, 29:30),
    # bağlamsız (4:81, 34:50, 23:98, 17:21, 3:186), uygunsuz ifade (22:78, 3:192).
    # 11-22: havuz tükendi (tüm ayetler paylaşılmıştı); her temaya yeni ayetler + iki yeni tema. Doğrulama deseni yine eler.
    ("İyilik Edin, İnfak Edin", "", r"infak|harca|sadaka|iyilik|ihsan", ["2:261", "2:274", "3:92", "64:16", "57:7", "2:195", "16:90", "55:60", "2:262", "57:18"]),
    ("Müminler Kardeştir", "", r"kardeş|alay|zan|tanış|ayrıl", ["49:10", "49:11", "49:12", "49:13", "3:103", "8:46"]),
    ("Allah'ı Çokça Anın", "", r"an[ıi]n|anma|anar|zikr|tesbih", ["33:41", "33:42", "3:191", "7:205", "63:9", "20:130", "50:39", "33:35", "17:44", "59:24", "87:1", "24:37"]),
]

# Sabah paylaşımları (11-19, kullanıcı isteği: "hayırlı sabahlar, hayırlı işler"): sabah, gündüz, çalışma, rızık ayetleri.
# bulk.py her sabah önce bir dua, ardından bunlardan 3'ünü atar.
# Diyanet meali bazı ardışık ayetleri tek metinde verir (30:17-18 aynı metin, Felak 1 bütün sure): aralık ya da elenir.
SABAH = ["30:17-18", "6:96", "93:1-3", "78:11", "25:47", "28:73", "62:10", "67:15", "9:105", "53:39", "94:7-8",
         "11:6", "51:58", "29:60", "17:78", "11:114", "76:25", "7:205"]
SABAH_PAT = r"bir işi|işleyin|sabah|gündüz|fecr|kuşluk|çalış|rız[ıi]?k|lütf|dağıl|yeryüzü|aydın|ağar|seher|tan yeri|karanlı"
MORNING = "Hayırlı sabahlar, hayırlı işler."
AMIN = "Duaya katılmak için yoruma Âmin yazın."

DUAS = ["2:127", "2:128", "2:201", "2:250", "3:8", "3:16", "3:53", "3:147", "3:193", "3:194", "7:23", "7:47",
        "7:126", "10:85", "14:40", "14:41", "18:10", "20:114", "21:89", "23:109", "23:118", "25:65", "25:74",
        "27:19", "28:24", "40:7", "46:15", "59:10", "60:4", "66:8", "71:28", "17:24", "17:80", "26:83",
        "20:25", "20:26", "20:27", "21:83", "23:29", "23:97", "26:169", "28:16", "28:24", "37:100",
        "3:38", "3:191", "14:35", "60:5", "66:11", "7:89", "7:151", "10:86", "11:47", "12:101", "26:84", "26:85", "26:87", "2:286"]

# Kırk Hadis: Peygamberimizin sözü kısa ve tek başına anlaşılır olanlar. Kısas/had içerenler ve
# uzun soru-cevaplı rivayetler (2, 4, 8, 14, 16, 17, 21, 22, 24, 25, 28, 29, 31) dışarıda.
# En uzun tırnak her zaman Peygamberimizin sözü değil: 40'ta en uzunu İbn Ömer'in sözü, 7'de cevabın
# yarısı. Bu ikisi kaynaktaki asıl söz (tur-nawawi metninden aynen).
OVERRIDE = {7: "Din nasihattir (samimiyettir).", 40: "Dünyada tıpkı bir yabancı veya bir yolcu gibi ol."}
HADIS = [1, 3, 5, 7, 9, 11, 12, 13, 15, 18, 20, 23, 26, 27, 30, 32, 34, 39, 40, 41]
# 11-19 analiz: hadis reels'lerinin %40'ı dağıtım almadı (ayet %7, dua %0). Yalnız kısa hadisler, seyrek.
HADIS_MAX = 90


def meal(key):
    v = R.verses(key)
    return " ".join(x[1] for x in v)


def merged(key):
    """Tek ayetin meali komşusuyla aynıysa (Diyanet birleşik meal) True: kart yanlış ayet numarası gösterir."""
    if "-" in key:
        return False
    sura, n = key.split(":")
    m = meal(key)
    for nb in (int(n) - 1, int(n) + 1):
        try:
            if nb > 0 and meal(f"{sura}:{nb}") == m:
                return True
        except Exception:
            pass
    return False


def checked(keys, pattern):
    out = []
    for k in keys:
        m = meal(k)
        if merged(k):
            print(f"ELENDİ {k}: meal komşu ayetle birleşik")
        elif not re.search(pattern, m, re.I):
            print(f"ELENDİ {k}: tema deseni yok — {m[:80]}")
        elif len(m) > MAX_MEAL:
            print(f"ELENDİ {k}: uzun ({len(m)})")
        else:
            out.append(k)
    return out


def ref(key):
    sura, nums = key.split(":")
    return f"{R.sura_name(sura)} Suresi {nums.replace('-', '–')}. ayet"


def cap(text, tags):
    return f"{text}\n\n{R.follow_caption(text)}\n\n{R.CTA}\n\n{tags}"


def title_card(kicker, title, sub):
    return (f'<div class="kicker">{kicker}</div><div class="title">{title}</div>'
            f'<div class="rule"></div><div class="ref" style="font-size:30px">{sub}</div>')


def end_card():
    return ('<div class="kicker">Hakyol</div><div class="rule"></div>'
            '<div class="meal" style="font-size:48px">Bu hatırlatmayı sevdiklerinize gönderin.</div>'
            '<div class="ref" style="font-size:30px;margin-top:40px">“Hayra vesile olan, onu yapan gibidir.” (Hadis-i&nbsp;Şerif)</div>')


def hadis_items():
    url = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/tur-nawawi.min.json"
    data = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "hakyol.app"}), timeout=120))
    by_no = {h["hadithnumber"]: h["text"] for h in data["hadiths"]}
    items = []
    for no in HADIS:
        quotes = re.findall(r"[“\"]([^”\"]{25,})[”\"]", by_no[no])
        text = OVERRIDE.get(no) or re.sub(r"\s+", " ", max(quotes, key=len)).strip()
        if len(text) > HADIS_MAX:
            continue
        body = (f'<div class="kicker">Kırk Hadis · {no}</div><div class="rule"></div>'
                f'<div class="meal">“{text}”</div><div class="ref">(Hadis-i Şerif)</div>')
        items.append({"kind": "single", "cards": [body],
                      "caption": cap(f"“{text}” (Hadis-i Şerif)\n\nKırk Hadis serisi, {no}. hadis.",
                                     "#hadis #hadisişerif #kırkhadis #sünnet #peygamberimiz #islam #müslüman #dua #hakyol")})
    return items


def main():
    singles = []
    for title, sub, pat, keys in THEMES:
        for k in checked(keys, pat):
            body, c = R.ayet(k, "Kur'an-ı Kerim")
            singles.append({"kind": "single", "cards": [body], "caption": cap(c, R.TAGS["ayet"])})
    duas = []
    for k in checked(DUAS, r"rabb"):
        body, c = R.ayet(k, "Kur'an'daki Dualar")
        duas.append({"kind": "single", "slot": "dua", "cards": [body],
                     "caption": cap(f"Kur'an'daki dualar.\n\n{c}\n\n{AMIN}", "#dua #kurandakidualar #rabbena #amin #ayet #kuran #islam #müslüman #hakyol")})
    sabah = []
    for k in checked(SABAH, SABAH_PAT):
        body, c = R.ayet(k, "Hayırlı Sabahlar")
        sabah.append({"kind": "single", "slot": "sabah", "cards": [body],
                      "caption": cap(f"{MORNING}\n\n{c}", "#hayırlısabahlar #günaydın #hayırlıişler #ayet #kuran #dua #islam #hakyol")})
    hadis = hadis_items()
    seen, uniq = set(), []
    for s in singles:
        if s["caption"] not in seen:
            seen.add(s["caption"])
            uniq.append(s)
    # Akış: 2 ayet, 1 dua; her 12 öğede bir kısa hadis. Sabah öğeleri sona eklenir (bulk.py yalnız sabah seçer).
    queue, i = [], 0
    while uniq or duas or hadis:
        for pool in (uniq, uniq, duas):
            if pool:
                queue.append(pool.pop(0))
        i += 1
        if i % 4 == 0 and hadis:
            queue.append(hadis.pop(0))
    queue += sabah
    for n, q in enumerate(queue):
        q["id"] = f"q{n:03d}"
    (HERE / "queue.json").write_text(json.dumps(queue, ensure_ascii=False, indent=0))
    kinds = lambda f: sum(1 for q in queue if f(q))
    print(f"{len(queue)} reels: {kinds(lambda q: q.get('slot') == 'dua')} dua, {kinds(lambda q: q.get('slot') == 'sabah')} sabah, "
          f"{kinds(lambda q: 'Kırk Hadis' in q['caption'])} hadis, {len(queue) - kinds(lambda q: q.get('slot') or 'Kırk Hadis' in q['caption'])} ayet")


if __name__ == "__main__":
    main()
