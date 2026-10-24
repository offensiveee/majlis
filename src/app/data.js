// Static data for the majlis home screen. Kept as plain JSON inside each [...] block: the deploy script turns them into data.json for the TV helper.

window.MAJLIS_CITIES = [
  { "id": "riyadh", "ar": "الرياض", "en": "Riyadh", "lat": 24.7136, "lon": 46.6753, "method": "UmmAlQura", "tz": 180 },
  { "id": "jeddah", "ar": "جدة", "en": "Jeddah", "lat": 21.4858, "lon": 39.1925, "method": "UmmAlQura", "tz": 180 },
  { "id": "makkah", "ar": "مكة المكرمة", "en": "Makkah", "lat": 21.3891, "lon": 39.8579, "method": "UmmAlQura", "tz": 180 },
  { "id": "madinah", "ar": "المدينة المنورة", "en": "Madinah", "lat": 24.5247, "lon": 39.5692, "method": "UmmAlQura", "tz": 180 },
  { "id": "dammam", "ar": "الدمام", "en": "Dammam", "lat": 26.4207, "lon": 50.0888, "method": "UmmAlQura", "tz": 180 },
  { "id": "khobar", "ar": "الخبر", "en": "Khobar", "lat": 26.2172, "lon": 50.1971, "method": "UmmAlQura", "tz": 180 },
  { "id": "ahsa", "ar": "الأحساء", "en": "Al Ahsa", "lat": 25.383, "lon": 49.586, "method": "UmmAlQura", "tz": 180 },
  { "id": "jubail", "ar": "الجبيل", "en": "Jubail", "lat": 27.0174, "lon": 49.6225, "method": "UmmAlQura", "tz": 180 },
  { "id": "qassim", "ar": "بريدة", "en": "Buraydah", "lat": 26.3592, "lon": 43.9818, "method": "UmmAlQura", "tz": 180 },
  { "id": "hail", "ar": "حائل", "en": "Hail", "lat": 27.5114, "lon": 41.7208, "method": "UmmAlQura", "tz": 180 },
  { "id": "taif", "ar": "الطائف", "en": "Taif", "lat": 21.2703, "lon": 40.4158, "method": "UmmAlQura", "tz": 180 },
  { "id": "abha", "ar": "أبها", "en": "Abha", "lat": 18.2164, "lon": 42.5053, "method": "UmmAlQura", "tz": 180 },
  { "id": "tabuk", "ar": "تبوك", "en": "Tabuk", "lat": 28.3835, "lon": 36.5662, "method": "UmmAlQura", "tz": 180 },
  { "id": "jazan", "ar": "جازان", "en": "Jazan", "lat": 16.8892, "lon": 42.5511, "method": "UmmAlQura", "tz": 180 },
  { "id": "najran", "ar": "نجران", "en": "Najran", "lat": 17.4933, "lon": 44.1277, "method": "UmmAlQura", "tz": 180 },
  { "id": "yanbu", "ar": "ينبع", "en": "Yanbu", "lat": 24.0895, "lon": 38.0618, "method": "UmmAlQura", "tz": 180 },
  { "id": "kharj", "ar": "الخرج", "en": "Al Kharj", "lat": 24.1556, "lon": 47.3346, "method": "UmmAlQura", "tz": 180 },
  { "id": "kuwait", "ar": "الكويت", "en": "Kuwait City", "lat": 29.3759, "lon": 47.9774, "method": "Kuwait", "tz": 180 },
  { "id": "doha", "ar": "الدوحة", "en": "Doha", "lat": 25.2854, "lon": 51.531, "method": "Qatar", "tz": 180 },
  { "id": "dubai", "ar": "دبي", "en": "Dubai", "lat": 25.2048, "lon": 55.2708, "method": "Dubai", "tz": 240 },
  { "id": "abudhabi", "ar": "أبوظبي", "en": "Abu Dhabi", "lat": 24.4539, "lon": 54.3773, "method": "Dubai", "tz": 240 },
  { "id": "manama", "ar": "المنامة", "en": "Manama", "lat": 26.2285, "lon": 50.586, "method": "UmmAlQura", "tz": 180 },
  { "id": "muscat", "ar": "مسقط", "en": "Muscat", "lat": 23.588, "lon": 58.3829, "method": "UmmAlQura", "tz": 240 }
];

window.MAJLIS_STATIONS = [
  { "id": "sa", "ar": "إذاعة القرآن الكريم", "sub": "السعودية · مباشر", "url": "https://stream.radiojar.com/0tpy1h0kxtzuv" },
  { "id": "maher", "ar": "ماهر المعيقلي", "sub": "تلاوات", "url": "https://backup.qurango.net/radio/maher" },
  { "id": "sudais", "ar": "عبدالرحمن السديس", "sub": "تلاوات", "url": "https://backup.qurango.net/radio/abdulrahman_alsudaes" },
  { "id": "shuraim", "ar": "سعود الشريم", "sub": "تلاوات", "url": "https://backup.qurango.net/radio/saud_alshuraim" },
  { "id": "yasser", "ar": "ياسر الدوسري", "sub": "تلاوات", "url": "https://backup.qurango.net/radio/yasser_aldosari" },
  { "id": "alafasi", "ar": "مشاري العفاسي", "sub": "تلاوات", "url": "https://backup.qurango.net/radio/mishary_alafasi" },
  { "id": "qatami", "ar": "ناصر القطامي", "sub": "تلاوات", "url": "https://backup.qurango.net/radio/nasser_alqatami" },
  { "id": "shatri", "ar": "أبو بكر الشاطري", "sub": "تلاوات", "url": "https://backup.qurango.net/radio/shaik_abu_bakr_al_shatri" },
  { "id": "ghamdi", "ar": "سعد الغامدي", "sub": "تلاوات", "url": "https://backup.qurango.net/radio/saad_alghamdi" },
  { "id": "basit", "ar": "عبدالباسط عبدالصمد", "sub": "مجود", "url": "https://backup.qurango.net/radio/abdulbasit_abdulsamad_mojawwad" },
  { "id": "minshawi", "ar": "محمد صديق المنشاوي", "sub": "مجود", "url": "https://backup.qurango.net/radio/mohammed_siddiq_alminshawi_mojawwad" },
  { "id": "husary", "ar": "محمود خليل الحصري", "sub": "مرتل", "url": "https://backup.qurango.net/radio/mahmoud_khalil_alhussary" },
  { "id": "salma", "ar": "تلاوات خاشعة", "sub": "متنوعة", "url": "https://backup.qurango.net/radio/salma" },
  { "id": "roqiah", "ar": "الرقية الشرعية", "sub": "متنوعة", "url": "https://backup.qurango.net/radio/roqiah" }
];

window.MAJLIS_BACKGROUNDS = [
  { "file": "backgrounds/dunes.jpg", "ar": "كثبان الغروب", "en": "Desert Dusk", "scrim": 0.35 },
  { "file": "backgrounds/sadu.jpg", "ar": "سدو", "en": "Sadu", "scrim": 0.72 },
  { "file": "backgrounds/mashrabiya.jpg", "ar": "مشربية", "en": "Mashrabiya", "scrim": 0.45 },
  { "file": "backgrounds/arches.jpg", "ar": "أقواس القصر", "en": "Palace Arches", "scrim": 0.6 },
  { "file": "backgrounds/damask.jpg", "ar": "دمشقي ملكي", "en": "Royal Damask", "scrim": 0.3 },
  { "file": "backgrounds/walnut.jpg", "ar": "خشب", "en": "Wood", "scrim": 0.55 },
  { "file": "backgrounds/marble.jpg", "ar": "رخام بيج", "en": "Beige Marble", "scrim": 0.65 }
];

window.MAJLIS_AYAT = [
  "وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً",
  "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
  "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
  "وَقُل رَّبِّ زِدْنِي عِلْمًا",
  "لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ",
  "فَاذْكُرُونِي أَذْكُرْكُمْ",
  "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ",
  "فَاللَّهُ خَيْرٌ حَافِظًا وَهُوَ أَرْحَمُ الرَّاحِمِينَ",
  "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً"
];

// Hijri occasions: month and day in the Umm al-Qura calendar.
window.MAJLIS_OCCASIONS = [
  { "ar": "رمضان", "m": 9, "d": 1, "during": "رمضان كريم" },
  { "ar": "عيد الفطر", "m": 10, "d": 1, "during": "عيدكم مبارك" },
  { "ar": "يوم عرفة", "m": 12, "d": 9, "during": "يوم عرفة" },
  { "ar": "عيد الأضحى", "m": 12, "d": 10, "during": "عيدكم مبارك" },
  { "ar": "رأس السنة الهجرية", "m": 1, "d": 1, "during": "سنة هجرية سعيدة" }
];

window.MAJLIS_PRAYERS = [
  { "key": "fajr", "ar": "الفجر", "alert": true },
  { "key": "sunrise", "ar": "الشروق", "alert": false },
  { "key": "dhuhr", "ar": "الظهر", "alert": true },
  { "key": "asr", "ar": "العصر", "alert": true },
  { "key": "maghrib", "ar": "المغرب", "alert": true },
  { "key": "isha", "ar": "العشاء", "alert": true }
];

// Adhan sounds (streamed when needed). The phone page lets you preview them.
window.MAJLIS_ADHANS = [
  { "id": "a1", "ar": "أذان ١", "url": "https://www.islamcan.com/audio/adhan/azan1.mp3" },
  { "id": "a2", "ar": "أذان ٢", "url": "https://www.islamcan.com/audio/adhan/azan2.mp3" },
  { "id": "a3", "ar": "أذان ٣", "url": "https://www.islamcan.com/audio/adhan/azan3.mp3" },
  { "id": "a4", "ar": "أذان ٤", "url": "https://www.islamcan.com/audio/adhan/azan4.mp3" },
  { "id": "a5", "ar": "أذان ٥", "url": "https://www.islamcan.com/audio/adhan/azan5.mp3" }
];
