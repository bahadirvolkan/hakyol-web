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

# (başlık, alt başlık, doğrulama deseni, ayetler)
THEMES = [
    ("Sabredenlere Müjde", "Kur'an'dan sabır ayetleri", r"sab[ıi]r|sabr", ["2:153", "2:155", "2:156", "2:157", "3:200", "39:10", "16:127", "11:115"]),
    ("Allah'ın Rahmetinden Ümit Kesmeyin", "Rahmet ve ümit ayetleri", r"rahmet|ümit|bağışla", ["39:53", "7:156", "12:87", "15:56", "6:54", "4:110"]),
    ("Tövbe Kapısı Açık", "Bağışlanma ayetleri", r"tövbe|tevbe|bağışla|mağfiret", ["66:8", "3:135", "25:70", "4:110", "11:3", "71:10"]),
    ("Namazı Dosdoğru Kılın", "Namaz ayetleri", r"namaz", ["2:45", "2:238", "4:103", "11:114", "17:78", "20:14", "29:45", "23:2"]),
    ("Şükrederseniz Artırırım", "Şükür ayetleri", r"ş[uü]k", ["14:7", "2:152", "31:12", "16:114", "2:172", "39:66"]),
    ("Allah'a Tevekkül Edin", "Tevekkül ayetleri", r"tevekkül|güven|yeter", ["3:159", "65:3", "3:173", "8:2", "9:51", "33:3", "14:12"]),
    ("Anne Babaya İyilik", "Kur'an'da anne baba", r"anne|baba|ana ", ["17:23", "17:24", "31:14", "46:15", "29:8", "2:83"]),
    ("Kalpler Huzur Bulur", "Huzur ayetleri", r"kalb|kalp|gönül|huzur|sükûnet|yatış|güven", ["13:28", "48:4", "89:27", "89:28", "3:126", "8:10"]),
    ("Dünya Hayatı Geçicidir", "Dünya ve ahiret", r"dünya|ahiret", ["57:20", "3:185", "29:64", "87:16", "87:17", "6:32"]),
    ("Allah Size Yakındır", "Yakınlık ve dua", r"yakın|dua|beraber", ["2:186", "50:16", "40:60", "57:4", "11:61", "7:56"]),
    ("Zorlukla Beraber Kolaylık", "Kolaylık ayetleri", r"kolay|güç|zorluk", ["94:5", "94:6", "65:7", "2:185", "2:286", "65:4"]),
    ("Allah'ı Çokça Anın", "Zikir ayetleri", r"an[ıi]n|anma|anar|zikr|tesbih", ["33:41", "33:42", "2:152", "3:191", "7:205", "62:10", "63:9"]),
]

DUAS = ["2:127", "2:128", "2:201", "2:250", "3:8", "3:16", "3:53", "3:147", "3:193", "3:194", "7:23", "7:47",
        "7:126", "10:85", "14:40", "14:41", "18:10", "20:114", "21:89", "23:109", "23:118", "25:65", "25:74",
        "27:19", "28:24", "40:7", "46:15", "59:10", "60:4", "66:8", "71:28", "17:24", "17:80", "26:83"]

# Kırk Hadis: Peygamberimizin sözü kısa ve tek başına anlaşılır olanlar. Kısas/had içerenler ve
# uzun soru-cevaplı rivayetler (2, 4, 8, 14, 16, 17, 21, 22, 24, 25, 28, 29, 31) dışarıda.
HADIS = [1, 3, 5, 7, 9, 11, 12, 13, 15, 18, 20, 23, 26, 27, 30, 32, 34, 39, 40, 41]


def meal(key):
    v = R.verses(key)
    return " ".join(x[1] for x in v)


def checked(keys, pattern):
    out = []
    for k in keys:
        m = meal(k)
        if not re.search(pattern, m, re.I):
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
        text = re.sub(r"\s+", " ", max(quotes, key=len)).strip()
        body = (f'<div class="kicker">Kırk Hadis · {no}</div><div class="rule"></div>'
                f'<div class="meal">“{text}”</div><div class="ref">(Hadis-i Şerif)</div>')
        items.append({"kind": "single", "cards": [body],
                      "caption": cap(f"“{text}” (Hadis-i Şerif)\n\nKırk Hadis serisi, {no}. hadis.",
                                     "#hadis #hadisişerif #kırkhadis #sünnet #peygamberimiz #islam #müslüman #dua #hakyol")})
    return items


def main():
    themes = []
    singles = []
    for title, sub, pat, keys in THEMES:
        ok = checked(keys, pat)
        for i in range(0, len(ok) - 2, 4):  # 3-4 ayetlik paketler
            part = ok[i:i + 4]
            cards = [title_card("Kur'an-ı Kerim", title, f"{sub} · {len(part)} ayet")]
            cards += [R.ayet(k, f"{title} · {n}/{len(part)}")[0] for n, k in enumerate(part, 1)]
            cards.append(end_card())
            text = f"{title}\n\n" + "\n\n".join(f"“{meal(k)}” ({ref(k)})" for k in part) + "\n\nDiyanet İşleri meali."
            themes.append({"kind": "pack", "cards": cards, "caption": cap(text, R.TAGS["ayet"])})
        for k in ok:
            body, c = R.ayet(k, "Kur'an-ı Kerim")
            singles.append({"kind": "single", "cards": [body], "caption": cap(c, R.TAGS["ayet"])})
    duas = []
    for k in checked(DUAS, r"rabb"):
        body, c = R.ayet(k, "Kur'an'daki Dualar")
        duas.append({"kind": "single", "cards": [body],
                     "caption": cap(f"Kur'an'daki dualar.\n\n{c}", "#dua #kurandakidualar #rabbena #ayet #kuran #islam #müslüman #hakyol")})
    hadis = hadis_items()
    # Aynı ayet hem tekli hem pakette olabilir; tekli tekrarları seyrelt.
    seen, uniq = set(), []
    for s in singles + duas:
        if s["caption"] not in seen:
            seen.add(s["caption"])
            uniq.append(s)
    pools = [themes, hadis, uniq[: len(uniq) // 2], uniq[len(uniq) // 2:]]
    queue = []
    while any(pools):
        for p in pools:
            if p:
                queue.append(p.pop(0))
    for n, q in enumerate(queue):
        q["id"] = f"q{n:03d}"
    (HERE / "queue.json").write_text(json.dumps(queue, ensure_ascii=False, indent=0))
    print(f"{len(queue)} reels: {sum(q['kind'] == 'pack' for q in queue)} paket, {len(hadis)} hadis, {len(uniq)} tek ayet/dua")


if __name__ == "__main__":
    main()
