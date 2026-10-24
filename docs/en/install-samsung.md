# Installing Majlis on a Samsung TV

[العربية](../ar/install-samsung.md) · [All TVs](install.md) · [Ask an AI to help](ai-help.md)

## What you need

> **In short:** a Samsung account, a computer with Tizen Studio and Node.js on the same network as the TV, and about 30 minutes the first time.

- A Samsung Smart TV with Tizen (2017 and newer)
- A computer (Windows, macOS or Linux) on the **same network** as the TV
- A free [Samsung account](https://account.samsung.com)
- [Tizen Studio](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html) with the TV extensions
- [Node.js 18 or newer](https://nodejs.org) and [Git](https://git-scm.com)

### What the Samsung version can and can't do

Samsung doesn't let apps keep a helper running in the background. So on Samsung you get the full screen (prayer times and alerts while Majlis is open, Quran radio, Hijri dates, occasions, calm mode, themes and frames, guest Wi-Fi card), but **not** the phone app, notifications over other apps, or the Home button. Settings are changed on the TV under **Majlis › Settings**, and the name, welcome, city and Wi-Fi are set in a file before installing (step 5).

## 1. Turn on Developer Mode on the TV

1. On your computer, find its IP address (Windows: `ipconfig`; macOS: System Settings › Wi-Fi › Details).
2. On the TV, open **Apps**.
3. With the remote, type **1 2 3 4 5**. A Developer Mode window opens.
4. Turn **Developer mode** on, enter your **computer's** IP address, and press **OK**.
5. Turn the TV off and on again (hold the power button until it restarts).

The TV's own IP address is under **Settings › General › Network › Network Status › IP Settings**.

## 2. Install Tizen Studio

1. Download and install [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download).
2. Open the **Package Manager** (it opens after installing, or from Tizen Studio's Tools menu).
3. Under **Main SDK**, install **Tizen SDK tools**.
4. Under **Extension SDK**, install **TV Extensions** (the newest version) and **Samsung Certificate Extension**.

## 3. Connect the TV

1. In Tizen Studio, open **Tools › Device Manager**.
2. Choose **Remote Device Manager**, press **+**, and enter a name and the **TV's** IP address (port 26101).
3. Turn the connection on. The TV appears in the device list.

## 4. Create your certificate

Samsung only installs apps signed for your TV.

1. Open **Tools › Certificate Manager** and press **+**.
2. Choose **Samsung**, then **TV**.
3. Name the profile **majlis**.
4. Create an **author certificate** (choose a password and keep it).
5. Sign in with your Samsung account when asked.
6. Create the **distributor certificate**. With the TV connected, its ID (DUID) is added automatically.
7. Make **majlis** the active profile.

## 5. Your settings

```bash
git clone https://github.com/offensiveee/majlis.git
cd majlis
npm install
cp majlis.config.example.json majlis.config.json
```

Open `majlis.config.json` and set your majlis name, welcome line, city (for example `riyadh`, `jeddah`, `kuwait`, `dubai`; the full list is in `src/app/data.js`) and guest Wi-Fi.

## 6. Build and install

```bash
npm run samsung -- --install <tv-ip>
```

This builds the app, signs it with the **majlis** profile and installs it. Majlis then appears in the TV's **Apps**; you can move it to the front of the app bar.

If Tizen Studio isn't in its default place, tell the script where it is:

```bash
TIZEN_STUDIO=/path/to/tizen-studio npm run samsung -- --install <tv-ip>
```

To only build the signed package: `npm run samsung -- --package`.

## Updating

Change `majlis.config.json` if you like, then run step 6 again.

## Removing

On the TV: **Apps**, highlight **مجلس**, press and hold OK (or choose Settings) › **Delete**.

## Problems

- **Can't connect to the TV**: the IP you typed in the TV's Developer Mode must be your computer's, and the TV must have been restarted after.
- **"Certificate" or "signature" errors**: make sure the **majlis** profile is active and was created while the TV was connected, so the TV's DUID is in it.
- **Developer Mode turned itself off**: some models drop it after a firmware update. Repeat step 1; Majlis stays installed.
