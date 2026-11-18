"""Kendi gönderilerimizdeki kısa, olumlu yorumlara kısa cevap (Âmin, Allah razı olsun).

    IG_TOKEN=... python3 instagram/replies.py [--dry]

Yalnız kalıba uyan kısa yorumlar (âmin, elhamdülillah, maşallah, sübhanallah, Allahu ekber,
sadakallah, Allah razı olsun, yalnız kalp/el) cevaplanır. Soru, tartışma, uzun yorum cevapsız
kalır. Bir yoruma ancak bir kez cevap verilir (cevap altında hakyol.app varsa atlanır).
Cevaplarda emoji yok. bulk.py her yayından sonra çağırır.

Şehir isteği (11-15): açıklamada "yoruma şehrinizi ya da ilçenizi yazın" çağrısı var. Yorum yalnız bir il/ilçe
adıysa ("Konya", "Of Trabzon", "Selçuklu lütfen") yorumcuya özel mesajla (private reply, yorum başına
bir kez, 7 gün içinde) o sayfanın linki gider, yoruma da kısa açık cevap yazılır (tekrar göndermeyi önler).
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import publish as P

ME = "hakyol.app"
MAX_PER_RUN = 15

# (desen, cevap) — ilk eşleşen kazanır; desenler aksansız küçük harf metne uygulanır.
RULES = [
    (r"\ba+m+i+y*n+\b|\bamen\b", "Âmin. Allah razı olsun."),
    (r"elhamd", "Elhamdülillah. Allah razı olsun."),
    (r"masa+l+ah", "Maşallah. Allah razı olsun."),
    (r"allah razi", "Cümlemizden razı olsun."),
    (r"s[uü]b?h?ana?l+ah|allah[u -]*ekber|allahuekber|sadakallah", "Allah razı olsun, hayırlı günler."),
]
ONLY_HEARTS = re.compile(r"^[\s❤️\U0001F49A-\U0001F49F\U0001F90D\U0001F90E\U0001F932\U0001F64F\U0001F33A\U0001F339\U0001F3FB-\U0001F3FF\u200d♥]+$")


SITE = "https://hakyol.app/namaz-vakitleri"
UTM = "utm_source=instagram&utm_medium=dm&utm_campaign=sehir"
# Yorumda il/ilçe adının yanında kalabilecek dolgu sözcükler; başka sözcük varsa şehir isteği sayılmaz.
FILLER = set("""namaz namazi vakti vakitleri vakitler vakit ezan saatleri saati il ili ilce ilcesi ilcem ilim merkez merkezi
sehir sehrim sehri memleket lutfen lutfen rica ederim selam selamun aleykum aleykumselam esselamu aleykum
hocam abi abla kardesim sevgiler tesekkurler sagol icin bana gonderir misiniz atar misiniz da de ve""".split())
# Tek başına günlük sözcük olan ilçe adları: ancak il adıyla birlikte yazılırsa eşleşir ("Of Trabzon").
COMMON = {"of", "pazar", "kale", "saray", "merkez", "bayat", "sur", "kemer", "yenice", "ulubey", "gonen"}


def norm(text):
    t = text.replace("İ", "i").replace("I", "ı").lower().replace("ı", "i")
    return "".join(c for c in unicodedata.normalize("NFKD", t) if not unicodedata.combining(c))


def answer(text):
    if "?" in text or len(text) > 60:
        return None
    if ONLY_HEARTS.match(text):
        return "Allah razı olsun."
    n = norm(text)
    for pat, reply in RULES:
        if re.search(pat, n):
            return reply
    return None


def _places():
    il, ilce = {}, {}
    for p in json.loads((Path(__file__).resolve().parent / "places.json").read_text()):
        il[norm(p["name"])] = (p["name"], p["slug"])
        for x in p["ilceler"]:
            ilce.setdefault(norm(x["name"]), []).append((x["name"], p["slug"], x["slug"], p["name"]))
    return il, ilce


IL, ILCE = _places()


def place_for(text):
    """Yorum yalnız il/ilçe adıysa (ad, url); değilse None."""
    if len(text) > 50:
        return None
    words = re.sub(r"[^a-z0-9 ]+", " ", norm(text)).split()
    if not words or len(words) > 6:
        return None
    used, il_hit, ilce_hits = set(), None, []
    for n in (3, 2, 1):  # çok sözcüklü adlar önce ("Mustafakemalpaşa" tek, "Bozcaada" tek; "Afyon karahisar" gibi)
        for i in range(len(words) - n + 1):
            if any(j in used for j in range(i, i + n)):
                continue
            w = " ".join(words[i:i + n])
            if w in IL and not il_hit:
                il_hit = IL[w]
                used |= set(range(i, i + n))
            elif w in ILCE:
                ilce_hits.append(w)
                used |= set(range(i, i + n))
    if any(w not in FILLER for j, w in enumerate(words) if j not in used):
        return None
    cands = [c for w in ilce_hits for c in ILCE[w] if not il_hit or c[1] == il_hit[1]]
    cands = [c for c in cands if il_hit or (norm(c[0]) not in COMMON)]
    if len(cands) == 1:
        name, il_slug, slug, il_name = cands[0]
        return f"{name} ({il_name})", f"{SITE}/{il_slug}/{slug}/?{UTM}"
    if il_hit:
        return il_hit[0], f"{SITE}/{il_hit[1]}/?{UTM}"
    return None


def send_city(c, place):
    name, url = place
    text = (f"{name} namaz vakitleri: {url}\n\n"
            "Sayfayı telefonunuzun ana ekranına eklerseniz vakitler her gün tek dokunuşla açılır. Hayırlı ibadetler.")
    P.call("POST", f"{P.IG_USER}/messages", recipient=json.dumps({"comment_id": c["id"]}), message=json.dumps({"text": text}))
    P.call("POST", f"{c['id']}/replies", message=f"{name.split(' (')[0]} vakitlerini mesaj kutunuza gönderdik. Hayırlı ibadetler.")


def run(dry=False, media_limit=25):
    done = 0
    for m in P.call("GET", f"{P.IG_USER}/media", fields="id,comments_count", limit=media_limit)["data"]:
        if not m.get("comments_count"):
            continue
        comments = P.call("GET", f"{m['id']}/comments", fields="id,text,username,replies{username}", limit=50)["data"]
        for c in comments:
            if c.get("username") == ME or any(r.get("username") == ME for r in c.get("replies", {}).get("data", [])):
                continue
            place = place_for(c.get("text") or "")
            if place:
                print("şehir", repr(c["text"][:40]), "->", place[1])
                if not dry:
                    try:
                        send_city(c, place)
                    except SystemExit as e:  # mesaj izni yoksa/7 gün geçtiyse yayını düşürmesin
                        print("şehir mesajı hatası:", e)
                        continue
                done += 1
                if done >= MAX_PER_RUN:
                    return done
                continue
            reply = answer(c.get("text") or "")
            if not reply:
                continue
            print("cevap", repr(c["text"][:40]), "->", reply)
            if not dry:
                P.call("POST", f"{c['id']}/replies", message=reply)
            done += 1
            if done >= MAX_PER_RUN:
                return done
    return done


if __name__ == "__main__":
    print(run(dry="--dry" in sys.argv), "yorum cevaplandı")
