# Troubleshooting

[العربية](../ar/troubleshooting.md) · [Back to README](../../README.md)

## Setup

**`npm run setup` can't reach the TV**
- Check that the computer and the TV are on the same network, and that the IP is the one shown in the Developer Mode app.
- Developer Mode must be on (Dev Mode Status), and the TV must be on, not in standby.

**"Failed to get ssh private key"**
- Turn on **Key Server** in the Developer Mode app, then run setup again.
- The passphrase is case-sensitive and changes when Developer Mode is turned off and on again.

**The pairing prompt never appeared, or timed out**
- The TV has to be on and showing a picture. Run setup again and choose **Accept** within two minutes.
- If you chose **Deny** by mistake, run setup again.

## Using it

**The phone page doesn't open**
- The phone must be on the same Wi-Fi as the TV. Guest networks and some mesh systems keep devices apart.
- Check the address under **Majlis › Settings** on the TV. If the TV's IP changed, see the next answer.

**The TV's IP address changed**
- Reserve a fixed address for the TV in your router (often called DHCP reservation or static lease).
- Then point Majlis at the new address: `npm run setup -- --name majlis --ip <new-ip>`, then `npm run deploy -- --name majlis`.

**Majlis disappeared from the TV**
- Developer Mode expired. Majlis renews it every 12 hours, but only when the TV has internet. Turn Developer Mode back on in the app and run `npm run deploy -- --name majlis` again. Your settings come back with it.

**Pressing Home shows LG's screen for a moment**
- That's expected: LG doesn't allow replacing its launcher, so Majlis switches back as soon as it opens.

**Prayer times are an hour off**
- Check the TV's time zone (Settings › General › System › Time & Date) and the city in Majlis settings.

**Quran radio or the adhan sound doesn't play**
- Both stream from the internet. Check the TV's connection, then try another station.
- The yellow button and the phone's radio button only work while Majlis is on screen.

**A remote button from the phone does nothing in some app**
- Some apps ignore LG's network remote input. The physical remote always works.

**After a power cut, the Home button opens LG's screen**
- The helper restarts within about 5 minutes. Opening Majlis from the app list starts it straight away.

## Still stuck?

Open an issue with your TV model, webOS version (from the Developer Mode app or `ares-device --system-info`), what you did and what you saw. Leave out your PIN and anything from `.majlis/`.
