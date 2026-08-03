# Hakyol Legal Sayfa Genişletme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hakyol landing page footer'ına User Guide linki eklemek, 4 dilli yeni bir user-guide.html
sayfası oluşturmak, ve KVKK metnini Kurul'a şikayet hakkı + sorumluluk reddi bölümüyle güçlendirmek.

**Architecture:** Statik HTML, GitHub Pages (`bahadirvolkan/hakyol-web`). Yeni sayfa mevcut
`terms.html`'in CSS + i18n script pattern'ini birebir kopyalar. Değişiklikler 3 bağımsız dosyada,
sırayla yapılabilir.

**Tech Stack:** Düz HTML/CSS/JS, framework yok, build adımı yok, test altyapısı yok.

## Global Constraints

- Mevcut i18n pattern korunur: `data-i18n="tr|en|id|bn"` attribute'u + `html[data-lang="X"]` CSS
  selector'ı + `localStorage.getItem('hakyol_lang')` script'i (terms.html satır 416-440'ta birebir
  örnek var).
- 4 dil sırası her zaman: Türkçe, English, Indonesia, বাংলা (tr, en, id, bn).
- Tüm yeni/değişen dosyalar UTF-8, mevcut dosya biçimini (2 space indent) korur.
- Hiçbir dosya `git push` ile uzağa gönderilmez — kullanıcı onayı olmadan push YOK. Her task
  sonunda yerel commit yeterli.

---

### Task 1: index.html footer'ına User Guide linki

**Files:**
- Modify: `index.html:383-402` (footer-links bloğu)

**Interfaces:**
- Consumes: mevcut `.footer-links a` CSS class'ı (index.html:170-172), mevcut i18n script'i
  (index.html:414+, değişmeyecek)
- Produces: `user-guide.html`'e giden link — Task 2'nin ürettiği dosya adıyla birebir eşleşmeli

- [ ] **Step 1: footer-links bloğuna 4. link ekle**

`index.html` dosyasında satır 396-401 (`<a href="terms.html">...</a>` bloğu) ile satır 402
(`</div>`) arasına şunu ekle:

```html
        <a href="user-guide.html">
          <span data-i18n="tr" class="inline">Kullanım Kılavuzu</span>
          <span data-i18n="en" class="inline">User Guide</span>
          <span data-i18n="id" class="inline">Panduan Pengguna</span>
          <span data-i18n="bn" class="inline">ব্যবহার নির্দেশিকা</span>
        </a>
```

Sonuç, satır 383-403 arası şöyle olmalı:

```html
      <div class="footer-links">
        <a href="privacy-policy.html">
          <span data-i18n="tr" class="inline">Gizlilik Politikası</span>
          <span data-i18n="en" class="inline">Privacy Policy</span>
          <span data-i18n="id" class="inline">Kebijakan Privasi</span>
          <span data-i18n="bn" class="inline">গোপনীয়তা নীতি</span>
        </a>
        <a href="kvkk-aydinlatma-metni.html">
          <span data-i18n="tr" class="inline">KVKK Aydınlatma Metni</span>
          <span data-i18n="en" class="inline">KVKK Disclosure Notice</span>
          <span data-i18n="id" class="inline">Pemberitahuan KVKK</span>
          <span data-i18n="bn" class="inline">KVKK প্রকাশ বিজ্ঞপ্তি</span>
        </a>
        <a href="terms.html">
          <span data-i18n="tr" class="inline">Kullanım Şartları</span>
          <span data-i18n="en" class="inline">Terms of Use</span>
          <span data-i18n="id" class="inline">Ketentuan Penggunaan</span>
          <span data-i18n="bn" class="inline">ব্যবহারের শর্তাবলী</span>
        </a>
        <a href="user-guide.html">
          <span data-i18n="tr" class="inline">Kullanım Kılavuzu</span>
          <span data-i18n="en" class="inline">User Guide</span>
          <span data-i18n="id" class="inline">Panduan Pengguna</span>
          <span data-i18n="bn" class="inline">ব্যবহার নির্দেশিকা</span>
        </a>
      </div>
```

- [ ] **Step 2: Görsel doğrulama**

Çalıştır: `open index.html` (macOS varsayılan tarayıcıda açar)
Beklenen: Footer'da 4 link görünür (Gizlilik Politikası, KVKK Aydınlatma Metni, Kullanım
Şartları, Kullanım Kılavuzu). Sayfa üstündeki dil değiştirme mekanizmasıyla (varsa nav'da lang
switch) 4 dilin hepsinde link metinlerinin değiştiğini kontrol et. `user-guide.html` henüz yoksa
tıklayınca 404 vermesi bu adımda normaldir (Task 2'de oluşturulacak).

- [ ] **Step 3: Commit**

```bash
cd ~/hakyol-web
git add index.html
git commit -m "Footer'a Kullanım Kılavuzu linki ekle"
```

---

### Task 2: Yeni user-guide.html (4 dilli kullanım kılavuzu)

**Files:**
- Create: `user-guide.html`

**Interfaces:**
- Consumes: `index.html`'in Task 1'de eklediği link (`href="user-guide.html"`) — dosya adı birebir
  bu olmalı
- Produces: `terms.html` ve `kvkk-aydinlatma-metni.html`'e giden çapraz linkler (Task 3'ün dosyası
  değişmeden kalır, sadece link hedefi)

- [ ] **Step 1: user-guide.html dosyasını oluştur**

`terms.html`'in tamamını şablon olarak kullanarak (aynı `<style>` bloğu, aynı `.lang-switch`
yapısı, aynı i18n script), aşağıdaki tam içerikle `user-guide.html` oluştur:

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hakyol – User Guide</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 720px;
      margin: 60px auto;
      padding: 0 24px;
      color: #222;
      line-height: 1.7;
    }
    h1 { font-size: 28px; margin-bottom: 4px; }
    .updated { color: #888; font-size: 14px; margin-bottom: 8px; }
    h2 { font-size: 18px; margin-top: 36px; margin-bottom: 8px; }
    p, li { margin: 0 0 12px; }
    ul { margin: 0 0 16px; padding-left: 22px; }
    a { color: #0070f3; }
    .lang-switch { display: flex; gap: 6px; margin-bottom: 28px; flex-wrap: wrap; }
    .lang-switch button {
      appearance: none; border: 1px solid #ddd; background: #fafafa; color: #444;
      font-size: 12.5px; font-weight: 600; letter-spacing: 0.3px;
      padding: 6px 13px; border-radius: 999px; cursor: pointer;
    }
    .lang-switch button.active { background: #111; color: #fff; border-color: #111; }
    .back-link { display: inline-block; margin-bottom: 8px; font-size: 14px; }
    [data-i18n] { display: none; }
    html[data-lang="tr"] [data-i18n="tr"],
    html[data-lang="en"] [data-i18n="en"],
    html[data-lang="id"] [data-i18n="id"],
    html[data-lang="bn"] [data-i18n="bn"] { display: block; }
  </style>
</head>
<body>

  <a class="back-link" href="index.html">← Hakyol</a>

  <div class="lang-switch" role="group" aria-label="Language">
    <button data-set-lang="tr">Türkçe</button>
    <button data-set-lang="en">English</button>
    <button data-set-lang="id">Indonesia</button>
    <button data-set-lang="bn">বাংলা</button>
  </div>

  <!-- ==================== TÜRKÇE ==================== -->
  <div data-i18n="tr">
    <h1>Kullanım Kılavuzu</h1>
    <p class="updated">Son güncelleme: 3 Ağustos 2026</p>

    <p>
      Hakyol'daki her ekranın ne işe yaradığına ve nasıl kullanılacağına dair kısa bir rehber.
    </p>

    <h2>Ana Sayfa</h2>
    <p>
      Günün özetini gösterir: bir sonraki namaz vaktine kalan süre, o günün beş vakti ve hızlı
      erişim kartları. Uygulamayı açtığınızda karşınıza ilk çıkan ekrandır.
    </p>

    <h2>Kıble</h2>
    <p>
      Cihazınızın pusulasını kullanarak bulunduğunuz konumdan Kâbe yönünü gösterir. Telefonu düz
      tutup pusula ibresini takip etmeniz yeterlidir. Konum izni gerektirir.
    </p>

    <h2>Namaz Vakitleri</h2>
    <p>
      Günün beş vaktini (İmsak, Öğle, İkindi, Akşam, Yatsı) detaylı liste halinde gösterir. Her
      vakit için ayrı ayrı hatırlatma açıp kapatabilir, hatırlatma süresini (vakitten kaç dakika
      önce) ayarlayabilirsiniz.
    </p>

    <h2>Kur'an-ı Kerim</h2>
    <p>
      Kur'an'ı sure sure okuyabilir veya dinleyebilirsiniz. Kaldığınız yer otomatik kaydedilir,
      hatim takibi ilerlemenizi gösterir.
    </p>

    <h2>Zikirmatik</h2>
    <p>
      Dijital tesbih sayacıdır. Ekrana dokunarak sayım yapar, hedef sayıya ulaştığınızda titreşimle
      bildirir. Farklı zikirler için ayrı sayaçlar tutabilirsiniz.
    </p>

    <h2>Kâbe Canlı</h2>
    <p>
      Mekke'deki Mescid-i Haram'dan 7/24 canlı yayını uygulama içinden izlersiniz, ayrı bir
      tarayıcıya gerek yoktur.
    </p>

    <h2>Yakın Camiler</h2>
    <p>
      Bulunduğunuz konuma göre çevrenizdeki camileri harita üzerinde listeler, her birine olan
      mesafeyi gösterir. Konum izni gerektirir.
    </p>

    <h2>Navigasyon</h2>
    <p>
      Yakın Camiler listesinden seçtiğiniz bir camiye yürüyerek veya araçla yol tarifi alırsınız,
      harita üzerinde adım adım yönlendirme sağlar.
    </p>

    <h2>Ayarlar</h2>
    <p>
      Uygulama dilini, temayı (açık/koyu), bildirim tercihlerini ve Premium abonelik durumunuzu
      buradan yönetirsiniz.
    </p>

    <h2>Premium</h2>
    <p>
      Namaz vakitleri özelliği herkese ücretsizdir. Kıble, Kur'an, Zikirmatik, Kâbe Canlı, Yakın
      Camiler ve Navigasyon gibi diğer tüm özellikler Premium abonelik gerektirir. Abonelik
      koşulları için <a href="terms.html">Kullanım Şartları</a>'na, veri işleme hakkında bilgi
      için <a href="kvkk-aydinlatma-metni.html">KVKK Aydınlatma Metni</a>'ne bakabilirsiniz.
    </p>
  </div>

  <!-- ==================== ENGLISH ==================== -->
  <div data-i18n="en">
    <h1>User Guide</h1>
    <p class="updated">Last updated: August 3, 2026</p>

    <p>
      A short guide to what each screen in Hakyol does and how to use it.
    </p>

    <h2>Home</h2>
    <p>
      Shows a summary of your day: time remaining until the next prayer, all five prayer times for
      the day, and quick-access cards. This is the first screen you see when you open the app.
    </p>

    <h2>Qibla</h2>
    <p>
      Uses your device's compass to show the direction of the Kaaba from your current location.
      Hold your phone flat and follow the compass needle. Requires location permission.
    </p>

    <h2>Prayer Times</h2>
    <p>
      Shows all five daily prayers (Fajr, Dhuhr, Asr, Maghrib, Isha) in a detailed list. You can
      turn reminders on or off individually for each prayer and set how many minutes before the
      prayer the reminder fires.
    </p>

    <h2>The Qur'an</h2>
    <p>
      Read or listen to the Qur'an surah by surah. Your last position is saved automatically, and
      khatm (completion) tracking shows your progress.
    </p>

    <h2>Dhikr Counter</h2>
    <p>
      A digital tasbih counter. Tap the screen to count, and it vibrates when you reach your
      target count. You can keep separate counters for different dhikrs.
    </p>

    <h2>Kaaba Live</h2>
    <p>
      Watch the 24/7 live stream from Masjid al-Haram in Mecca directly inside the app, no separate
      browser needed.
    </p>

    <h2>Nearby Mosques</h2>
    <p>
      Lists mosques around your current location on a map, showing the distance to each. Requires
      location permission.
    </p>

    <h2>Navigate</h2>
    <p>
      Get walking or driving directions to a mosque you selected from Nearby Mosques, with
      step-by-step guidance on the map.
    </p>

    <h2>Settings</h2>
    <p>
      Manage the app language, theme (light/dark), notification preferences, and your Premium
      subscription status here.
    </p>

    <h2>Premium</h2>
    <p>
      Prayer Times is free for everyone. All other features — Qibla, Qur'an, Dhikr Counter, Kaaba
      Live, Nearby Mosques, and Navigate — require a Premium subscription. See our
      <a href="terms.html">Terms of Use</a> for subscription terms, and our
      <a href="kvkk-aydinlatma-metni.html">KVKK Disclosure Notice</a> for how your data is
      processed.
    </p>
  </div>

  <!-- ==================== BAHASA INDONESIA ==================== -->
  <div data-i18n="id">
    <h1>Panduan Pengguna</h1>
    <p class="updated">Terakhir diperbarui: 3 Agustus 2026</p>

    <p>
      Panduan singkat tentang fungsi setiap layar di Hakyol dan cara menggunakannya.
    </p>

    <h2>Beranda</h2>
    <p>
      Menampilkan ringkasan hari Anda: waktu yang tersisa hingga salat berikutnya, kelima waktu
      salat hari itu, dan kartu akses cepat. Ini adalah layar pertama yang Anda lihat saat membuka
      aplikasi.
    </p>

    <h2>Kiblat</h2>
    <p>
      Menggunakan kompas perangkat Anda untuk menunjukkan arah Ka'bah dari lokasi Anda saat ini.
      Pegang ponsel Anda secara datar dan ikuti jarum kompas. Memerlukan izin lokasi.
    </p>

    <h2>Waktu Salat</h2>
    <p>
      Menampilkan kelima waktu salat harian (Subuh, Zuhur, Asar, Magrib, Isya) dalam daftar
      terperinci. Anda dapat mengaktifkan atau menonaktifkan pengingat untuk setiap salat secara
      terpisah dan mengatur berapa menit sebelum waktu salat pengingat akan berbunyi.
    </p>

    <h2>Al-Qur'an</h2>
    <p>
      Baca atau dengarkan Al-Qur'an surah demi surah. Posisi terakhir Anda disimpan secara
      otomatis, dan pelacakan khatam menunjukkan kemajuan Anda.
    </p>

    <h2>Penghitung Dzikir</h2>
    <p>
      Penghitung tasbih digital. Ketuk layar untuk menghitung, dan akan bergetar saat Anda mencapai
      jumlah target. Anda dapat menyimpan penghitung terpisah untuk dzikir yang berbeda.
    </p>

    <h2>Ka'bah Langsung</h2>
    <p>
      Tonton siaran langsung 24/7 dari Masjidil Haram di Mekah langsung di dalam aplikasi, tanpa
      perlu browser terpisah.
    </p>

    <h2>Masjid Terdekat</h2>
    <p>
      Menampilkan daftar masjid di sekitar lokasi Anda saat ini pada peta, menunjukkan jarak ke
      masing-masing. Memerlukan izin lokasi.
    </p>

    <h2>Navigasi</h2>
    <p>
      Dapatkan petunjuk arah berjalan kaki atau berkendara ke masjid yang Anda pilih dari Masjid
      Terdekat, dengan panduan langkah demi langkah di peta.
    </p>

    <h2>Pengaturan</h2>
    <p>
      Kelola bahasa aplikasi, tema (terang/gelap), preferensi notifikasi, dan status langganan
      Premium Anda di sini.
    </p>

    <h2>Premium</h2>
    <p>
      Waktu Salat gratis untuk semua orang. Semua fitur lainnya — Kiblat, Al-Qur'an, Penghitung
      Dzikir, Ka'bah Langsung, Masjid Terdekat, dan Navigasi — memerlukan langganan Premium. Lihat
      <a href="terms.html">Ketentuan Penggunaan</a> kami untuk ketentuan langganan, dan
      <a href="kvkk-aydinlatma-metni.html">Pemberitahuan KVKK</a> kami untuk cara data Anda
      diproses.
    </p>
  </div>

  <!-- ==================== বাংলা ==================== -->
  <div data-i18n="bn">
    <h1>ব্যবহার নির্দেশিকা</h1>
    <p class="updated">সর্বশেষ আপডেট: ৩ আগস্ট ২০২৬</p>

    <p>
      Hakyol-এর প্রতিটি স্ক্রিন কী কাজ করে এবং কীভাবে ব্যবহার করতে হয় তার একটি সংক্ষিপ্ত নির্দেশিকা।
    </p>

    <h2>হোম</h2>
    <p>
      আপনার দিনের একটি সারসংক্ষেপ দেখায়: পরবর্তী নামাজের জন্য অবশিষ্ট সময়, দিনের পাঁচ ওয়াক্ত এবং
      দ্রুত-অ্যাক্সেস কার্ড। অ্যাপ খোলার সময় এটিই প্রথম স্ক্রিন যা আপনি দেখেন।
    </p>

    <h2>কিবলা</h2>
    <p>
      আপনার বর্তমান অবস্থান থেকে কাবার দিক দেখাতে আপনার ডিভাইসের কম্পাস ব্যবহার করে। ফোনটি সমতল ধরে
      কম্পাস কাঁটা অনুসরণ করুন। অবস্থানের অনুমতি প্রয়োজন।
    </p>

    <h2>নামাজের সময়</h2>
    <p>
      পাঁচ ওয়াক্ত নামাজ (ফজর, জোহর, আসর, মাগরিব, এশা) বিস্তারিত তালিকায় দেখায়। আপনি প্রতিটি নামাজের
      জন্য আলাদাভাবে অনুস্মারক চালু বা বন্ধ করতে পারেন এবং নামাজের কত মিনিট আগে অনুস্মারক বাজবে তা
      নির্ধারণ করতে পারেন।
    </p>

    <h2>কুরআন</h2>
    <p>
      সূরা অনুযায়ী কুরআন পড়ুন বা শুনুন। আপনার শেষ অবস্থান স্বয়ংক্রিয়ভাবে সংরক্ষিত হয় এবং খতম ট্র্যাকিং
      আপনার অগ্রগতি দেখায়।
    </p>

    <h2>জিকির কাউন্টার</h2>
    <p>
      একটি ডিজিটাল তসবিহ কাউন্টার। গণনা করতে স্ক্রিনে আলতো চাপুন, এবং লক্ষ্য সংখ্যায় পৌঁছালে এটি
      কম্পন করবে। বিভিন্ন জিকিরের জন্য আলাদা কাউন্টার রাখতে পারেন।
    </p>

    <h2>কাবা লাইভ</h2>
    <p>
      মক্কার মসজিদুল হারাম থেকে ২৪/৭ লাইভ সম্প্রচার সরাসরি অ্যাপের মধ্যে দেখুন, আলাদা ব্রাউজারের
      প্রয়োজন নেই।
    </p>

    <h2>নিকটবর্তী মসজিদ</h2>
    <p>
      মানচিত্রে আপনার বর্তমান অবস্থানের আশেপাশের মসজিদগুলি তালিকাভুক্ত করে, প্রতিটির দূরত্ব দেখায়।
      অবস্থানের অনুমতি প্রয়োজন।
    </p>

    <h2>নেভিগেশন</h2>
    <p>
      নিকটবর্তী মসজিদ থেকে নির্বাচিত মসজিদে হেঁটে বা গাড়িতে যাওয়ার দিকনির্দেশ পান, মানচিত্রে ধাপে ধাপে
      নির্দেশনা সহ।
    </p>

    <h2>সেটিংস</h2>
    <p>
      এখান থেকে অ্যাপের ভাষা, থিম (হালকা/গাঢ়), নোটিফিকেশন পছন্দ এবং আপনার প্রিমিয়াম সাবস্ক্রিপশন
      স্থিতি পরিচালনা করুন।
    </p>

    <h2>প্রিমিয়াম</h2>
    <p>
      নামাজের সময় সবার জন্য বিনামূল্যে। অন্য সব বৈশিষ্ট্য — কিবলা, কুরআন, জিকির কাউন্টার, কাবা লাইভ,
      নিকটবর্তী মসজিদ এবং নেভিগেশন — প্রিমিয়াম সাবস্ক্রিপশন প্রয়োজন। সাবস্ক্রিপশনের শর্তাবলীর জন্য
      আমাদের <a href="terms.html">ব্যবহারের শর্তাবলী</a> এবং আপনার ডেটা কীভাবে প্রক্রিয়া করা হয় তার
      জন্য <a href="kvkk-aydinlatma-metni.html">KVKK প্রকাশ বিজ্ঞপ্তি</a> দেখুন।
    </p>
  </div>

<script>
(function() {
  var supported = ['tr', 'en', 'id', 'bn'];
  var saved = localStorage.getItem('hakyol_lang');
  var browserLang = (navigator.language || 'tr').slice(0, 2);
  var initial = supported.indexOf(saved) !== -1 ? saved : (supported.indexOf(browserLang) !== -1 ? browserLang : 'tr');

  function setLang(lang) {
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem('hakyol_lang', lang);
    document.querySelectorAll('.lang-switch button').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-set-lang') === lang);
    });
  }

  document.querySelectorAll('.lang-switch button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setLang(btn.getAttribute('data-set-lang'));
    });
  });

  setLang(initial);
})();
</script>

</body>
</html>
```

- [ ] **Step 2: Görsel doğrulama**

Çalıştır: `open user-guide.html`
Beklenen: Sayfa açılır, "Kullanım Kılavuzu" başlığı ve 9 bölüm (Ana Sayfa, Kıble, Namaz
Vakitleri, Kur'an-ı Kerim, Zikirmatik, Kâbe Canlı, Yakın Camiler, Navigasyon, Ayarlar) + Premium
bölümü görünür. Üstteki 4 dil butonuna (Türkçe/English/Indonesia/বাংলা) tek tek tıklayıp her
dilde içeriğin doğru değiştiğini kontrol et. "← Hakyol" linkinin `index.html`'e, alt kısımdaki
Terms/KVKK linklerinin doğru dosyalara gittiğini kontrol et.

- [ ] **Step 3: Task 1'in linkini doğrula**

Çalıştır: `open index.html`, footer'daki "Kullanım Kılavuzu" linkine tıkla.
Beklenen: `user-guide.html` açılır (artık 404 vermiyor).

- [ ] **Step 4: Commit**

```bash
cd ~/hakyol-web
git add user-guide.html
git commit -m "4 dilli Kullanım Kılavuzu sayfası ekle"
```

---

### Task 3: kvkk-aydinlatma-metni.html revizyonu

**Files:**
- Modify: `kvkk-aydinlatma-metni.html:88-138` (madde 4, madde 6, madde 7 ve sonrası)

**Interfaces:**
- Consumes: yok (bağımsız dosya, tek dil)
- Produces: yok (terminal task, başka task bu dosyaya bağlı değil)

- [ ] **Step 1: Madde 4'e (açık rıza) vurgu cümlesi ekle**

`kvkk-aydinlatma-metni.html` satır 88-96, mevcut madde 4 paragrafının sonuna (kapanış `</p>`
etiketinden hemen önce) şu cümleyi ekle:

Mevcut (satır 88-96):
```html
  <h2>4. Kişisel Veri Toplamanın Yöntemi ve Hukuki Sebebi</h2>
  <p>
    Konum verisi, iOS işletim sisteminin izin mekanizması üzerinden, açık rızanızla ve yalnızca
    Uygulama kullanımda iken otomatik yöntemlerle (cihazın konum servisleri aracılığıyla) elde
    edilir. İşlemenin hukuki sebebi KVKK madde 5/1 uyarınca <strong>açık rızanızdır</strong> —
    konum iznini reddetmeniz veya iOS Ayarlar üzerinden geri almanız halinde Uygulamanın konuma
    dayalı özellikleri (kıble, namaz vakti, navigasyon, yakın cami) çalışmaz, ancak Uygulamanın
    diğer bölümleri (Kur'an okuma, zikirmatik vb.) kullanılmaya devam edilebilir.
  </p>
```

Yeni hali:
```html
  <h2>4. Kişisel Veri Toplamanın Yöntemi ve Hukuki Sebebi</h2>
  <p>
    Konum verisi, iOS işletim sisteminin izin mekanizması üzerinden, açık rızanızla ve yalnızca
    Uygulama kullanımda iken otomatik yöntemlerle (cihazın konum servisleri aracılığıyla) elde
    edilir. İşlemenin hukuki sebebi KVKK madde 5/1 uyarınca <strong>açık rızanızdır</strong> —
    konum iznini reddetmeniz veya iOS Ayarlar üzerinden geri almanız halinde Uygulamanın konuma
    dayalı özellikleri (kıble, namaz vakti, navigasyon, yakın cami) çalışmaz, ancak Uygulamanın
    diğer bölümleri (Kur'an okuma, zikirmatik vb.) kullanılmaya devam edilebilir. Verdiğiniz açık
    rızayı dilediğiniz zaman iOS Ayarlar &gt; Gizlilik &gt; Konum Servisleri üzerinden geri
    alabilirsiniz; bu geri alma geçmişe etkili değildir, yalnızca gelecekteki veri işlemeyi
    durdurur.
  </p>
```

- [ ] **Step 2: Madde 6'ya Kurul'a şikayet hakkı ekle**

Satır 106-124, mevcut madde 6 listesinin altındaki paragrafı değiştir.

Mevcut (satır 120-124):
```html
  <p>
    Bu haklarınızı kullanmak için <a href="mailto:hakyolapp@gmail.com">hakyolapp@gmail.com</a>
    adresinden bizimle iletişime geçebilirsiniz.
  </p>
```

Yeni hali:
```html
  <p>
    Bu haklarınızı kullanmak için <a href="mailto:hakyolapp@gmail.com">hakyolapp@gmail.com</a>
    adresinden bizimle iletişime geçebilirsiniz. Yukarıdaki haklarınızın kullanılmasına ilişkin
    talebinizin reddedilmesi, yetersiz bulunması veya süresinde cevap verilmemesi hâllerinde,
    cevabı öğrendiğiniz tarihten itibaren 30 gün ve her hâlde başvuru tarihinden itibaren 60 gün
    içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunma hakkınız bulunmaktadır.
  </p>
```

- [ ] **Step 3: Yeni "8. Sorumluluk Reddi" bölümü ekle**

Satır 126-135, mevcut madde 7 ("Değişiklikler") öncesine yeni bir madde ekle, mevcut madde 7
"8. Değişiklikler" olarak numaralanır.

Mevcut (satır 126-135):
```html
  <h2>7. Değişiklikler</h2>
  <p>
    Bu metinde önemli bir değişiklik yapılması halinde, sayfanın en üstündeki güncelleme tarihi
    yenilenecektir.
  </p>

  <p>
    Genel gizlilik uygulamaları için ayrıca bkz.
    <a href="./privacy-policy.html">Privacy Policy</a>.
  </p>
```

Yeni hali:
```html
  <h2>7. Sorumluluk Reddi</h2>
  <ul>
    <li>Google Maps Platform, Diyanet namaz vakti kaynağı ve RevenueCat gibi üçüncü taraf
      hizmet sağlayıcılara aktarılan veriler, bu sağlayıcıların kendi gizlilik ve güvenlik
      politikaları çerçevesinde işlenir; bu sağlayıcıların veri güvenliği uygulamalarından
      yalnızca kendileri sorumludur.</li>
    <li>Konum verisinin doğruluğu cihazınızın sensörlerine, GPS sinyaline ve internet bağlantı
      kalitesine bağlıdır; bu etkenlerden kaynaklanan sapmalardan doğabilecek zararlardan
      geliştirici sorumlu tutulamaz.</li>
    <li>Namaz vakitleri, kıble yönü ve Kur'an-ı Kerim metni gibi dini içerik, güvenilir
      kaynaklardan derlenmekle birlikte kesin doğruluk garantisi taşımaz; kritik ibadet
      kararlarınız için yerel dini otoritelere başvurmanızı öneririz.</li>
  </ul>

  <h2>8. Değişiklikler</h2>
  <p>
    Bu metinde önemli bir değişiklik yapılması halinde, sayfanın en üstündeki güncelleme tarihi
    yenilenecektir.
  </p>

  <p>
    Genel gizlilik uygulamaları için ayrıca bkz.
    <a href="./privacy-policy.html">Privacy Policy</a>.
  </p>
```

- [ ] **Step 4: Güncelleme tarihini yenile**

Satır 30:
```html
  <p class="updated">Son güncelleme: 15 Temmuz 2026</p>
```
şu şekilde değiştir:
```html
  <p class="updated">Son güncelleme: 3 Ağustos 2026</p>
```

- [ ] **Step 5: Görsel doğrulama**

Çalıştır: `open kvkk-aydinlatma-metni.html`
Beklenen: Sayfa açılır, madde numaraları sırayla 1'den 8'e kadar kesintisiz gider (4. maddede
yeni cümle, 6. maddede Kurul şikayet cümlesi, 7. madde "Sorumluluk Reddi" olarak yeni, 8. madde
"Değişiklikler"). Sayfa altındaki "Privacy Policy" linki çalışır.

- [ ] **Step 6: Commit**

```bash
cd ~/hakyol-web
git add kvkk-aydinlatma-metni.html
git commit -m "KVKK metnine Kurul sikayet hakki ve Sorumluluk Reddi bolumu ekle"
```
