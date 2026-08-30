# Hakyol — hakyol.app

Landing page for **[Hakyol](https://hakyol.app)** — a prayer times, qibla and
Qur'an app for iOS and Android, available in 7 languages
(Turkish, English, Arabic, Farsi, Urdu, Bengali, Indonesian).

- **Website:** https://hakyol.app
- **App Store:** https://apps.apple.com/app/hakyol/id6794740149
- **Google Play:** https://play.google.com/store/apps/details?id=com.bahadir.hakyol

## What Hakyol does

- Prayer times with adhan/notification reminders and a home-screen widget
- Qibla compass and map
- Live qibla + nearest-mosque routing while navigating
- Holy Qur'an: offline reading, word-by-word synchronized recitation, khatm mode
- Dhikr counter, the 99 Names of Allah (Esma-ül Hüsna)
- Live streams of the Kaaba and the Prophet's Mosque
- Hakyol Radio, Hijri calendar
- No ads

## This repo

Static site served by GitHub Pages at `hakyol.app`. `src/index.html` is the
single source; `node build.js` generates the per-language pages (`/en/`, `/ar/`,
…) with `hreflang`, structured data and a localized `<head>`.

```
npm install
npm run build
```
