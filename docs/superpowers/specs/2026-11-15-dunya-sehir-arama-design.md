# Dünya Şehirleri ve Şehir Araması Tasarımı

## Amaç

Hakyol'un mevcut statik Türkiye namaz vakitleri ağacını, Diyanet aynasından seçilmiş yurt dışı şehirlerle genişletmek ve tüm yerleri klavyeyle erişilebilir tek aramada buldurmak.

## Yaklaşım

Mevcut Node tabanlı üretim zinciri ve HTML şablonları genişletilecek; yeni framework veya çalışma zamanı bağımlılığı eklenmeyecek. Tek seferlik `build-dunya-list.js`, hız sınırlı Diyanet uçlarını GeoNames cities15000 ile eşleyip commitlenecek küçük veri dosyasını üretir. Vakit çekici Türkiye ve dünya kimliklerini aynı depoda tutar. `build-cities.js` ortak şablonla ülke/şehir sayfalarını, arama indeksini ve site haritasını üretir. Tarayıcı araması bağımsız ve Node'da test edilebilir saf işlevler sunar.

## Kısıtlar

- Diyanet isteklerinde belirtilen User-Agent, en az 1500 ms aralık ve 429 için 60 saniye bekleme zorunlu.
- Yurt dışı saatleri dönüştürülmez.
- Çıktılar statik, bağımlılıksız ve RTL uyumlu olur.
- Git, dağıtım ve dış sisteme yazma yapılmaz.

## Değerlendirilen yollar

- Seçilen: mevcut üreticileri cerrahi biçimde genişletmek; şablon ve veri deposu tekrarını önler.
- Ayrı dünya sayfası üreticisi: daha az ilk temas, fakat şablon/SEO davranışını kopyalayıp zamanla ayrıştıracağı için reddedildi.
- İstemci tarafında uzaktan şehir/vakit yüklemek: GitHub Pages'in mevcut statik SEO modeline uymadığı için reddedildi.

