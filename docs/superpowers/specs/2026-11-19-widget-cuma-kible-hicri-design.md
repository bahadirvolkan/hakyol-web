# Hakyol Widget, Cuma, Kıble ve Hicri Sayfaları Tasarımı

## Amaç

Hakyol'un Diyanet vakit verisini gizlilik dostu bir gömülebilir widget ile paylaşmak; cuma, kıble ve hicri aramalarına özgü, her gece güncellenen statik sayfalar üretmek.

## Kısıtlar

- GitHub Pages üzerinde yalnız statik dosyalar; yeni npm bağımlılığı yok.
- Üretilen şehir/API/cuma/kıble/hicri çıktıları commit edilmez.
- Widget yalnız `hakyol.app` JSON uçlarına istek yapar; çerez, depolama, analiz ve üçüncü taraf istek yoktur.
- Emoji, Google Fonts CDN, commit/push/dağıtım yoktur.
- Mevcut koyu yeşil/altın görsel dil ve sayfa üretim desenleri korunur.

## Yaklaşım

Ortak saf hesaplar `lib/features.js` altında toplanır. `build-cities.js` Türkiye şehir API uçlarını, `build-world.js` Diyanet Türkçe yurt dışı şehir API uçlarını üretir. `build-features.js` API indeksini ve cuma/kıble/hicri/widget hazırlama sayfalarını üretip `sitemap-namaz.xml` dosyasını tamamlar. Workflow bu üreticileri sıralı çalıştırır.

Tek dev üretici seçilmedi: mevcut şehir ve dünya sahipliğini bozardı. Tam bağımsız üreticiler seçilmedi: yol/ad/veri eşlemesini çoğaltırdı.

## Arayüz

Widget Shadow DOM ile yalıtılır; özgün fallback bağlantısı korunur. Hazırlama sayfalarında etiketli şehir/tema/dil kontrolleri, canlı önizleme, kopyalama geri bildirimi ve WordPress notu bulunur. Yeni içerik sayfaları mevcut kart, tablo, breadcrumb ve uygulama CTA desenlerini kullanır; klavye odağı ve mobil taşma gözetilir.

## Doğrulama

Saf hesaplar, API şeması ve üretim davranışı Node testleriyle TDD uygulanarak korunur. Tam build, tüm testler, iç bağlantı kontrolü, dosya adet/boyut ölçümü ve git durumu son kapıdır.
