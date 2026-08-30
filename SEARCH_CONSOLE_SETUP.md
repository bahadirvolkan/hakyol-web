# Google Search Console — bir kerelik kurulum (kullanıcı yapar)

Amaç: hakyol.app'in aramada nasıl performans gösterdiğini görmek + Google'a
7 dilli yapıyı (sitemap) bildirmek. **Kullanıcı takibi değil** — sadece arama
performansı verisi, uygulamanın "no tracking" sözünü bozmaz.

## 1. Domain property ekle (~5 dk)

1. https://search.google.com/search-console → **Add property**
2. **Domain** tipini seç (URL prefix değil) → `hakyol.app` yaz → Continue
3. Google bir **DNS TXT kaydı** verecek: `google-site-verification=xxxxxxxx`
4. Bu TXT'yi `hakyol.app` DNS'ine ekle (domain'i nereden aldıysan — kayıt
   sağlayıcının DNS paneli):
   - Type: `TXT`
   - Name/Host: `@` (veya boş / `hakyol.app`)
   - Value: `google-site-verification=xxxxxxxx` (Google'ın verdiği tam metin)
   - TTL: default
5. Kaydet, birkaç dakika bekle → Search Console'da **Verify**
   (DNS yayılması bazen 1 saat sürebilir, sabırlı ol)

Domain property tüm alt-dizinleri (`/en/`, `/ar/` …) ve `http`/`https`/`www`
varyantlarını tek seferde kapsar — bu yüzden meta etiket yerine DNS TXT tercih
edildi.

## 2. Sitemap gönder (~1 dk)

Search Console → sol menü **Sitemaps** → `sitemap.xml` yaz → **Submit**.

`sitemap.xml` build script (`node build.js`) tarafından üretiliyor, 7 dilin
ana sayfaları + hreflang alternatifleri + 4 yasal sayfa içeriyor.

## 3. Bing (opsiyonel, ~2 dk)

https://www.bing.com/webmasters → **Import from Google Search Console** →
tek tıkla hakyol.app'i içeri aktar. Ayrı doğrulama gerekmez.

## Sonra ne olur

- Birkaç gün içinde Search Console "Coverage / Pages" altında 7 dilde sayfalar
  **Indexed** görünmeye başlar.
- "Performance" sekmesi hangi aramalardan geldiğini, hangi ülkeden, hangi sırada
  çıktığını gösterir — bu veri gelecekte içerik/keyword kararları için.
- **hreflang hataları** varsa "International Targeting" (veya Pages > hreflang)
  altında uyarır — o durumda `build.js` düzeltilir.
