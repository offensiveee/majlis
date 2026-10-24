# Third-party software, fonts and data

Majlis includes or uses the following. Their licences apply to those parts.

## Bundled

| What | Used for | Licence |
|---|---|---|
| [adhan-js](https://github.com/batoulapps/adhan-js) 4.4 by Batoul Apps | Prayer time calculation (`src/app/lib/adhan.js`) | MIT, [licenses/MIT-adhan-js.txt](licenses/MIT-adhan-js.txt) |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase | Guest Wi-Fi QR code (`src/app/lib/qrcode.js`) | MIT (header of the file) |
| [ws](https://github.com/websockets/ws) 7.x | WebSocket client in the TV helper (added at build time) | MIT, [licenses/MIT-ws.txt](licenses/MIT-ws.txt) |
| Pairing manifest from [lgtv2](https://github.com/hobbyquaker/lgtv2) by Sebastian Raff | `vendor/lgtv2-pairing.json` | MIT, [licenses/MIT-lgtv2.txt](licenses/MIT-lgtv2.txt) |
| [Noto Kufi Arabic](https://fonts.google.com/noto/specimen/Noto+Kufi+Arabic) | Arabic text | SIL OFL 1.1, [licenses/OFL-NotoKufiArabic.txt](licenses/OFL-NotoKufiArabic.txt) |
| [Cormorant Garamond](https://github.com/CatharsisFonts/Cormorant) | Latin text and numbers | SIL OFL 1.1, [licenses/OFL-CormorantGaramond.txt](licenses/OFL-CormorantGaramond.txt) |
| [Amiri Quran](https://github.com/aliftype/amiri) | Quranic verses | SIL OFL 1.1, [licenses/OFL-AmiriQuran.txt](licenses/OFL-AmiriQuran.txt) |

The backgrounds and the icon were drawn for this project (sources in `scripts/art/`) and are covered by the project's MIT licence.

## Used at runtime, not bundled

| Service | Used for | Terms |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) | Weather | Free for non-commercial use; data under CC BY 4.0. Weather data by Open-Meteo.com |
| [mp3quran.net](https://mp3quran.net) | Quran radio streams | Streams are played from their servers |
| [IslamCan](https://www.islamcan.com/audio/adhan/) | Optional adhan recordings | Played from their site when chosen |
| LG webOS CLI ([@webos-tools/cli](https://github.com/webos-tools/cli)) | Installing on the TV | Apache 2.0 (dev dependency) |
| [AndroidX Core and WebKit](https://developer.android.com/jetpack/androidx) | The Android TV app (Gradle dependencies) | Apache 2.0 |
| [Tizen Studio](https://developer.tizen.org) | Signing and installing on Samsung | Samsung's SDK terms (installed by you) |

LG, webOS, Samsung and the names and logos of streaming apps are trademarks of their owners. App icons are read from your own TV at runtime and aren't included in this repository.
