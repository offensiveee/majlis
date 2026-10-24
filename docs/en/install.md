# Installing Majlis on an LG TV

[العربية](../ar/install.md) · [Back to README](../../README.md)

This takes about ten minutes the first time. You do it once per TV; after that the TV runs Majlis on its own.

## What you need

- An LG TV with webOS 6 or newer (2021 and later). Older webOS 4–5 models may work.
- A computer (Windows, macOS or Linux) on the **same network** as the TV
- [Node.js 18 or newer](https://nodejs.org) and [Git](https://git-scm.com)
- A free LG developer account, created at [webostv.developer.lge.com](https://webostv.developer.lge.com) (top right, "Sign in" → "Create account")

## 1. Turn on Developer Mode on the TV

1. On the TV, open **LG Content Store** (or **Apps**) and search for **Developer Mode**. Install it.
2. Open **Developer Mode** and sign in with your LG developer account.
3. Turn on **Dev Mode Status**. The TV restarts.
4. Open **Developer Mode** again. You'll see the TV's **IP address** and a **passphrase**. Keep this screen open.
5. Turn on **Key Server**.

> Developer Mode normally switches itself off after 50 hours. Majlis renews it automatically every 12 hours as long as the TV has internet, so you won't need to press **Extend**.

## 2. Get Majlis on your computer

```bash
git clone https://github.com/offensiveee/majlis.git
cd majlis
npm install
```

## 3. Add the TV

Pick a short name for the TV (for example `majlis`, `living` or `bedroom`) and use the IP address from step 1:

```bash
npm run setup -- --name majlis --ip 192.168.1.40
```

The script walks you through three things:

1. **Developer key**: when asked, type the passphrase from the Developer Mode screen.
2. **Remote-control pairing**: a prompt appears on the TV. Choose **Accept**.
3. **Phone PIN**: a 4-digit PIN is created for the phone app.

Everything is saved in `.majlis/majlis.json` on your computer. It contains the keys to your TV, so keep it private (it's already excluded from Git).

## 4. Install

```bash
npm run deploy -- --name majlis
```

Majlis is installed and opens on the TV. The first start takes a few seconds while the helper connects.

## 5. Set up your phone

1. On a phone connected to the same Wi-Fi, open `http://<tv-ip>:8090` (the script prints the exact address).
2. Enter the PIN. You can also find it on the TV under **Majlis › Settings**.
3. Add it to your home screen:
   - **iPhone**: in Safari, tap Share, then **Add to Home Screen**
   - **Android**: in Chrome, open the ⋮ menu, then **Add to Home screen**

Then, from the phone:
- **Settings**: choose your **city** for prayer times and the weather
- **Guests**: add your **guest Wi-Fi**

## 6. Recommended TV settings

These are LG settings, not Majlis ones, but they make the experience better:

| Setting | Where | Why |
|---|---|---|
| Quick Start+ → On | Settings › General › Devices › TV Management | Turns on in a second and keeps Majlis running |
| Home Promotion → Off | Settings › General › System › Additional Settings › Home Settings | Fewer ads in LG's own screens |
| Home Auto Launch → Off | Same place | The TV starts on your last input instead of LG's launcher |
| A fixed IP for the TV | Your router (DHCP reservation) | The phone address never changes |

## More than one TV

Repeat steps 1, 3 and 4 with a different name:

```bash
npm run setup -- --name bedroom --ip 192.168.1.41
npm run deploy -- --name bedroom
```

Each TV keeps its own settings, photos and PIN.

## Updating

```bash
git pull
npm run deploy -- --name majlis
```

Your settings and photos stay on the TV.

## Removing

```bash
npm run remove -- --name majlis
```

You can also turn off Developer Mode on the TV, which removes all developer apps.

## If something goes wrong

See [troubleshooting](troubleshooting.md).
