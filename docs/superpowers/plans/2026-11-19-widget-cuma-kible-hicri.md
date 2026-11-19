# Hakyol Widget, Cuma, Kıble ve Hicri Sayfaları Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widget API'leri ile cuma, kıble ve hicri statik sayfalarını mevcut GitHub Pages üretimine eklemek.

**Architecture:** Saf hesaplar ortak bir CommonJS modülünde; Türkiye/dünya API çıktıları mevcut üreticilerde; çapraz özellik sayfaları ayrı üreticide oluşturulur. Tüm yayın çıktıları workflow sırasında üretilir ve ignore edilir.

**Tech Stack:** Node.js 22, vanilla JavaScript, statik HTML/CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-19-widget-cuma-kible-hicri-design.md`

## Global Constraints

- Yeni npm bağımlılığı, emoji, Google Fonts CDN, çerez/izleme ve üçüncü taraf widget isteği yok.
- Git commit/push, `gh` ve dağıtım yok.
- Şehir ve özellik çıktıları workflow'da üretilir; commit edilmez.

## Review Focus

- Saat dilimi gece yarısı geçişinde doğru veri satırı ve sonraki vakit.
- Veri sonu/ağ hatasında fallback bağlantısının korunması.
- Türkçe karakterli şehir/ilçe yolları ve dosya karşılıkları.
- Cuma seçiminin cuma günü bugünü, diğer günler gelecek cumayı seçmesi.
- Kıble açısı ve mesafesinin derece/radyan karışıklığından korunması.

---

### Task 1: Saf hesaplar ve testler

**Files:** Create `lib/features.js`; create `test/features.test.js`.

**Interfaces:** Produce `qiblaBearing`, `haversineKm`, `nextFriday`, `zonedNowParts`, `nextPrayer`, `validateApiPayload`.

- [ ] Failing tests: İstanbul/Berlin/Köln kıble açıları, İstanbul mesafesi, cuma seçimi, saat dilimli geri sayım ve API şeması.
- [ ] Testlerin beklenen nedenle başarısız olduğunu doğrula.
- [ ] En küçük saf uygulamayı ekle ve testleri geçir.

### Task 2: Koordinat ve API üretimi

**Files:** Create `scripts/build-il-koordinat.js`, `data/il-koordinat.json`; modify `build-cities.js`, `build-world.js`.

**Interfaces:** Produce `/api/vakit/**/*.json` and partial index rows consumed by Task 4.

- [ ] 81/81 Türkiye sınırı/eşleşme testini yaz ve kırmızı çalıştır.
- [ ] GeoNames atıflı koordinat verisini ve API üretimini uygula.
- [ ] Şema testini gerçek üretilmiş örneklerle geçir.

### Task 3: Widget

**Files:** Create `widget.js`; extend `test/features.test.js`.

**Interfaces:** Consume API payload; preserve source anchor; support `tr/de/en/nl`, `acik/koyu/seffaf`.

- [ ] Widget davranış sözleşmesi testini önce yaz ve kırmızı çalıştır.
- [ ] Shadow DOM render, çoklu örnek, timezone countdown ve yeniden fetch davranışını uygula.
- [ ] Ham/gzip boyut kapısını doğrula.

### Task 4: Özellik sayfaları ve sitemap

**Files:** Create `build-features.js`; modify `build-cities.js`, `build-world.js`, shared navigation sources.

**Interfaces:** Produce API index, 82 cuma, 81+world kıble, one hicri, two widget setup pages; update `sitemap-namaz.xml`.

- [ ] Üretim ve kritik içerik testlerini önce yazıp kırmızı çalıştır.
- [ ] Sayfa üreticisini, JSON-LD/canonical/hreflang ve iç bağlantıları uygula.
- [ ] Üretim testlerini geçir.

### Task 5: Workflow, yasal metinler ve indeksleme

**Files:** Modify `.github/workflows/pages.yml`, `.gitignore`, `build.js`/legal sources, `scripts/indexnow.js` as needed.

**Interfaces:** Workflow runs all generators; IndexNow reads new URLs from existing sitemap.

- [ ] Yasal metin/widget paragrafı ve 19 Kasım 2026 tarihi; tüm Türkçe footer bağlantıları.
- [ ] Ignore ve workflow adımlarını ekle.
- [ ] Build çıktılarında yedi dil gizlilik + KVKK metnini doğrula.

### Task 6: Tam doğrulama

**Files:** Create/modify internal-link checker if necessary.

- [ ] `node build.js && node build-cities.js && node build-world.js && node build-features.js`.
- [ ] `node --test test/*.test.js` ve iç bağlantı kontrolü.
- [ ] API/sayfa adetleri ve boyutları, widget ham/gzip, `git status` raporu.
