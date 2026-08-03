# Hakyol Legal Sayfa Genişletme — Design

**Repo:** `bahadirvolkan/hakyol-web` (GitHub Pages, statik HTML)

## Amaç

Hakyol landing page'inde şu an KVKK ve Privacy Policy ve Terms sayfaları var ama:
- Aralarında net bir navigasyon yok (yalnızca terms.html içinden çapraz linkler var)
- User Guide (uygulama kullanım kılavuzu) hiç yok
- KVKK metni, Kurul'a şikayet hakkı ve genel sorumluluk reddi bakımından eksik

## Kapsam

### 1. index.html — Nav menüsü

Landing page'e (mevcut 4 dilde: tr/en/id/bn) footer'a yeni bir bölüm eklenir:
"Yasal / Legal" başlığı altında 4 link — Privacy Policy, KVKK Aydınlatma Metni,
Kullanım Şartları, Kullanım Kılavuzu. index.html'in mevcut dil sistemine
(`data-i18n` + `lang-switch`) uygun şekilde her dilde link metni çevrilir.

### 2. Yeni user-guide.html

`terms.html` ile birebir aynı teknik yapı (aynı CSS, aynı i18n script, aynı
lang-switch pattern), 4 dilde (tr/en/id/bn). İçerik: ekran ekran kullanım
kılavuzu. Her ekran için 2-4 cümlelik "ne işe yarar / nasıl kullanılır" metni:

1. Ana Sayfa (Home) — namaz vakti özeti, günlük görünüm
2. Kıble (Qibla) — pusula tabanlı yön bulma
3. Namaz Vakitleri (Prayer Times) — detaylı vakit listesi, hatırlatma ayarları
4. Kur'an (Quran) — okuma/dinleme
5. Zikirmatik — sayaç kullanımı
6. Kâbe Canlı (Kaaba Live) — canlı yayın
7. Yakın Camiler (Nearby Mosques) — harita, yol tarifi
8. Navigasyon (Navigate) — cami rotası
9. Ayarlar (Settings) — dil, tema, bildirim, abonelik yönetimi

Sayfa sonunda Premium özelliklerin nelerdik olduğuna dair kısa not + Terms/KVKK'ya link.

### 3. kvkk-aydinlatma-metni.html revizyonu

Mevcut yapı korunur (tek dil, Türkçe — KVKK zaten Türkiye hukukuna özgü).
İki değişiklik:

**a) Madde 6'ya ekleme** — İlgili Kişi Hakları listesinin sonuna Kurul'a
şikayet hakkı eklenir:
> "Yukarıdaki haklarınızın kullanılmasına ilişkin taleplerinizi yazılı olarak
> veya Kişisel Verileri Koruma Kurulu tarafından belirlenen diğer yöntemlerle
> iletebilir; talebinizin reddedilmesi, yetersiz bulunması veya süresinde
> cevap verilmemesi hâllerinde Kişisel Verileri Koruma Kurulu'na şikâyette
> bulunma hakkına sahipsiniz."

**b) Yeni "8. Sorumluluk Reddi" bölümü** (mevcut "7. Değişiklikler"den önce
eklenir, madde numaraları kaymaz — Değişiklikler ve son link paragrafı 8/9
olarak kayar):
- Üçüncü taraf servislerin (Google Maps, Diyanet kaynağı, RevenueCat) kendi
  veri güvenliği politikalarından yalnızca kendilerinin sorumlu olduğu
- Konum verisinin doğruluğunun cihaz sensörleri/bağlantı kalitesine bağlı
  olduğu, bundan doğabilecek sapmalardan geliştiricinin sorumlu tutulamayacağı
- Dini içeriğin (namaz vakti, kıble, Kur'an metni) kesin doğruluk garantisi
  taşımadığı, kritik ibadet kararları için yerel dini otoriteye başvurulması
  gerektiği (Terms madde 5 ile tutarlı, KVKK içinde de tekrar edilir)

Açık rıza maddesi (madde 4) içerik olarak zaten yeterli, sadece küçük bir
vurgu cümlesi eklenir: rıza her zaman iOS Ayarlar'dan geri alınabilir.

## Test/Doğrulama

Statik HTML, test altyapısı yok. Doğrulama:
- Her yeni/değişen dosyayı tarayıcıda (`open index.html` local) açıp 4 dilin
  hepsinde lang-switch çalıştığını kontrol et
- user-guide.html ve index.html nav linklerinin doğru dosyalara gittiğini
  kontrol et
- kvkk-aydinlatma-metni.html'de madde numaralandırmasının tutarlı olduğunu
  kontrol et

## Deploy

GitHub Pages otomatik — `main` branch'e push sonrası birkaç dakika içinde
canlıya çıkar. Push öncesi kullanıcı onayı alınır (dışa dönük, geri dönüşü
kolay ama public değişiklik).
