"""Kendi gönderilerimizdeki kısa, olumlu yorumlara kısa cevap (Âmin, Allah razı olsun).

    IG_TOKEN=... python3 instagram/replies.py [--dry]

Yalnız kalıba uyan kısa yorumlar (âmin, elhamdülillah, maşallah, sübhanallah, Allahu ekber,
sadakallah, Allah razı olsun, yalnız kalp/el) cevaplanır. Soru, tartışma, uzun yorum cevapsız
kalır. Bir yoruma ancak bir kez cevap verilir (cevap altında hakyol.app varsa atlanır).
Cevaplarda emoji yok. bulk.py her yayından sonra çağırır.
"""
import re
import sys
import unicodedata

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
ONLY_HEARTS = re.compile(r"^[\s❤️\U0001F49A-\U0001F49F\U0001F90D\U0001F90E\U0001F932\U0001F64F\U0001F33A\U0001F339♥]+$")


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


def run(dry=False, media_limit=25):
    done = 0
    for m in P.call("GET", f"{P.IG_USER}/media", fields="id,comments_count", limit=media_limit)["data"]:
        if not m.get("comments_count"):
            continue
        comments = P.call("GET", f"{m['id']}/comments", fields="id,text,username,replies{username}", limit=50)["data"]
        for c in comments:
            if c.get("username") == ME or any(r.get("username") == ME for r in c.get("replies", {}).get("data", [])):
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
