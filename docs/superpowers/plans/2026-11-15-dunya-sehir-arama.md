# Dünya Şehirleri ve Şehir Araması Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yurt dışı Diyanet şehir sayfalarını ve tüm yerleri kapsayan erişilebilir şehir aramasını üretmek.

**Architecture:** Veri hazırlama, vakit çekme, statik sayfa üretme ve istemci araması mevcut Node zincirinde ayrı sorumluluklarda kalır. Saf eşleme/arama işlevleri Node testlerinden dışa açılır.

**Tech Stack:** Node.js 22, vanilla JavaScript, statik HTML/CSS, node:test

**Spec:** `docs/superpowers/specs/2026-11-15-dunya-sehir-arama-design.md`

## Global Constraints

- Diyanet User-Agent tam olarak `hakyol.app city pages (info@hakyol.app)`.
- İstekler arası en az 1500 ms; 429 sonrası 60 saniye.
- Yeni bağımlılık yok; git/dağıtım yok.

## Review Focus

- Aksanlı/Almanca/Türkçe ad normalizasyonu ve `munih` eş adı.
- İl/ülke sonuçlarının alt yerlerden önce sıralanması.
- GeoNames aynı kaydına çift Diyanet eşleşmesinin elenmesi.
- Eksik/eski dünya vakitlerinin eski veriyi silmemesi.
- Üretilen bütün iç bağlantıların dosya karşılığının bulunması.

### Task 1: Dünya listesi

**Files:** Create `scripts/build-dunya-list.js`, `data/diyanet-dunya.json`; Test `test/world-list.test.js`

- [ ] Saf slug/eşleme işlevleri için başarısız test yaz ve çalıştır.
- [ ] Hız sınırlı Diyanet + GeoNames üreticisini uygula.
- [ ] Testi geçir ve betiği çalıştırarak ülke sayılarını doğrula.

### Task 2: Vakit çekimi

**Files:** Modify `scripts/fetch-vakitler.js`, `data/vakitler.json`

- [ ] Dünya kimlik kapsamı ve bayrak seçimi için başarısız test yaz.
- [ ] Ortak kuyruk ve `--only-world` davranışını uygula.
- [ ] Testi geçir; dünya vakitlerini yerelde çek.

### Task 3: Sayfa ve arama üretimi

**Files:** Modify `build-cities.js`, `build.js`, `js/analytics.js`; Create `js/city-search.js`; Test `test/city-search.test.js`

- [ ] Normalizasyon/sıralama/limit için başarısız test yaz.
- [ ] Bağımsız arama bileşenini ve analitiği uygula.
- [ ] Ülke/şehir/hub/arama.json/site haritası üretimini ekle.
- [ ] Ana sayfaya arama öğesi ve deferred script ekle.

### Task 4: Doğrulama

**Files:** Modify `.github/workflows/pages.yml` yalnız veri üretimini yayın zincirine bağlamak gerekirse.

- [ ] İstenen iki build komutunu çalıştır.
- [ ] Sayfa örneği, tarih ve altı vakti kontrol et.
- [ ] Arama boyutlarını ve dört örnek sorgunun ilk sonucunu yazdır.
- [ ] Yerel HTTP sunucusunda bütün `/namaz-vakitleri/` iç bağlantılarını kontrol et.
- [ ] Değişen dosyaları ve doğrulama çıktılarını özetle.
