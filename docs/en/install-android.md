# Installing Majlis on Android TV, Google TV or Fire TV

[العربية](../ar/install-android.md) · [All TVs](install.md) · [Ask an AI to help](ai-help.md)

Works on Sony, TCL, Hisense (Google TV models), Philips, Xiaomi, Toshiba and Sharp TVs, and on Chromecast with Google TV, Google TV Streamer, Nvidia Shield and Amazon Fire TV sticks. Any TV with HDMI works through one of those sticks.

## What you need

> **In short:** the TV and its remote, and a phone on the same Wi-Fi. No computer, no account.

- Android TV 5.0 or newer (almost every Android TV from 2016 on)
- Internet on the TV
- The free **Downloader** app (by AFTVnews), from the Google Play Store or the Amazon Appstore

## 1. Allow installing Majlis

Android only installs apps from outside the store after you allow it once.

**Android TV / Google TV**
1. Install **Downloader** from the Play Store.
2. Open **Settings › Apps › Security & restrictions › Unknown sources** (on Google TV: **Settings › Apps › Security & Restrictions › Unknown sources**).
3. Turn it on for **Downloader**.

> Can't find it? On some TVs you first need Developer options: **Settings › System › About**, then press OK seven times on **Android TV OS build**.

**Fire TV**
1. Install **Downloader** from the Amazon Appstore.
2. **Settings › My Fire TV › Developer options › Install unknown apps** (or **Apps from Unknown Sources**) → turn it on for **Downloader**.
   If you don't see Developer options: **Settings › My Fire TV › About**, then press OK seven times on the device name.

## 2. Install

1. Open **Downloader**.
2. In the address box, type:

   ```
   https://github.com/offensiveee/majlis/releases/latest/download/majlis-android.apk
   ```

3. Press **Go**. When it finishes, choose **Install**, then **Open**.

Majlis starts and its helper begins running in the background.

## 3. Make it the home screen

**Most Android TVs (Sony, TCL, Philips, Xiaomi…)**
Press **Home** on the remote. If you're asked which app to use, choose **مجلس** and **Always**.
If you aren't asked: **Settings › Apps › Default apps › Home app** (the name varies) → **مجلس**.

**Google TV (Chromecast, Google TV Streamer) and Fire TV**
These keep their own home screen. Majlis still works; open it from the apps row, or use a key-mapping app such as *Button Mapper* to open Majlis with a long press.

To go back to the original home screen at any time, choose it in the same setting, or uninstall Majlis.

## 4. Set up your phone

1. On the TV, open **Majlis › Settings**. You'll see the phone address and PIN.
2. On a phone on the same Wi-Fi, open that address (for example `http://192.168.1.50:8090`) and enter the PIN.
3. Add it to the home screen (Safari: Share › **Add to Home Screen**; Chrome: ⋮ › **Add to Home screen**).
4. From the phone, pick your **city** and add the **guest Wi-Fi**.

## What's different on Android

- The phone remote moves around Majlis. Inside other apps, use the TV remote (Android doesn't let one app press buttons in another).
- Turning the TV off from the phone and the energy-saving timer aren't available.
- At adhan time over another app, "pause the video" uses Android's audio focus: most players pause and resume by themselves afterwards.

## Updating

Repeat step 2. Your settings and photos are kept.

## Removing

**Settings › Apps › مجلس › Uninstall**. The TV goes back to its own home screen.

## From a computer instead

If you prefer, install with [adb](https://developer.android.com/tools/adb):

```bash
adb connect <tv-ip>
adb install majlis-android.apk
```

## Building it yourself

```bash
npm run android            # copies the screen into android/app/src/main/assets
```

Then open `android/` in Android Studio, or run `gradle -p android assembleRelease`. Every push to `main` also builds the APK on GitHub Actions.
