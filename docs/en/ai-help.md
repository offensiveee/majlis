# Get an AI assistant to walk you through it

[العربية](../ar/ai-help.md) · [All TVs](install.md)

If you'd rather be guided one step at a time, copy one of the prompts below into ChatGPT, Claude, Gemini or any assistant that can read web pages. Fill in the parts in [brackets] first.

The prompts tell the assistant to follow this project's own guides, go one step at a time, and never ask for your passwords.

## Any TV (start here if you're not sure)

```text
I want to install Majlis, an open-source TV interface that I can shape around what I need:
https://github.com/offensiveee/majlis

My TV: [brand and model, for example "LG 65QNED91" or "Samsung QA55Q60"].
My computer, if I have one: [Windows / Mac / Linux / no computer].

Please:
1. Read the guide that matches my TV from https://github.com/offensiveee/majlis/blob/main/docs/en/install.md
   and tell me in one or two sentences what I'll need and how long it takes.
2. Guide me ONE step at a time. After each step, wait for me to say "done" or to paste what I see.
3. Use the project's guide as the source of truth. If something on my screen looks different, ask me
   to describe it or send a photo, and adapt.
4. If a command fails, ask me to paste the exact output, explain the problem in simple words, and fix it.
5. Never ask me for my LG, Samsung, Google or Amazon password. I'll type those myself on the official screens.
6. Keep it short and friendly. Answer in English.
```

## LG

```text
Help me install Majlis on my LG TV ([model], webOS [version if you know it]) using this guide:
https://github.com/offensiveee/majlis/blob/main/docs/en/install-lg.md

My computer is [Windows / Mac / Linux]. Go one step at a time and wait for me after each one:
turning on Developer Mode on the TV, installing Node.js and Git, running "npm run setup" and
"npm run deploy", then opening the phone app. If a command fails, ask me to paste the output.
Never ask for my LG account password. Answer in English.
```

## Android TV, Google TV or Fire TV

```text
Help me install Majlis on my [Android TV / Google TV / Fire TV] ([brand and model]) using this guide:
https://github.com/offensiveee/majlis/blob/main/docs/en/install-android.md

I only have the TV remote and my phone. Go one step at a time and wait for me after each one:
allowing the Downloader app to install apps, downloading the Majlis APK, opening it, making it the
home screen if my TV allows it, and opening the phone app. Tell me exactly which menus to open on
my model. Answer in English.
```

## Samsung

```text
Help me install Majlis on my Samsung TV ([model]) using this guide:
https://github.com/offensiveee/majlis/blob/main/docs/en/install-samsung.md

My computer is [Windows / Mac / Linux]. Go one step at a time and wait for me after each one:
Developer Mode on the TV (Apps, then 1 2 3 4 5), installing Tizen Studio and its TV extensions,
connecting the TV, creating the Samsung certificate profile called "majlis", editing
majlis.config.json, and running "npm run samsung -- --install <tv-ip>". If something fails,
ask me to paste the output or describe the screen. Never ask for my Samsung account password.
Answer in English.
```

## Something went wrong

```text
I'm installing Majlis (https://github.com/offensiveee/majlis) on my [TV brand and model].
I was at this step: [which step].
This is what happened / the exact error:

[paste the error or describe what you see]

Check https://github.com/offensiveee/majlis/blob/main/docs/en/troubleshooting.md first, then tell me
what's wrong in simple words and how to fix it, one step at a time.
```

## A note on safety

- An assistant should never need your passwords, your Majlis PIN, or the files in the `.majlis/` folder. Don't paste those.
- Only run commands that come from this project's guides, or that you understand.
