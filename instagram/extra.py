"""extra.json'daki bugünkü hazır videoları (ig-extra dalı) tam saatinde yayınlar; GitHub'da tek iş olarak bekler.

    IG_TOKEN=... python3 instagram/extra.py

11-20: Cuma gökyüzü reels'i öğleden önce yarım saatte bir (kullanıcı: Cuma paylaşımları namazdan önce bitsin).
Saati geçmiş ama paylaşılmamış video hemen yayınlanır. Aynı açıklama bugün varsa atlanır.
"""
import json
import time
from datetime import datetime

import bulk as B

items = sorted((x for x in json.loads((B.HERE / "extra.json").read_text())
                if x["at"][:10] == datetime.now(B.TSI).strftime("%Y-%m-%d")), key=lambda x: x["at"])
for x in items:
    at = datetime.strptime(x["at"], "%Y-%m-%dT%H:%M").replace(tzinfo=B.TSI)
    wait = (at - datetime.now(B.TSI)).total_seconds()
    if wait > 0:
        print("bekleniyor", x["id"], x["at"], flush=True)
        time.sleep(wait)
    if x["caption"].strip() in {c.strip() for c in B.published()[1]}:
        print("zaten paylaşılmış", x["id"])
        continue
    B.publish(f"{B.EXTRA_RAW}/{x['file']}", x["caption"], x["id"], "extra")
