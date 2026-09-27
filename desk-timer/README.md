# Desk Timer

A plain timer for the Mac that stays on top of Ableton, Logic or anything else.
It shows white digits on black with no colour. It can count up or count down,
sound an alarm, and beep at intervals you choose.

## Setup (once)

1. Open **Terminal** and install Apple's command-line build tools if you haven't already:
   ```
   xcode-select --install
   ```
   (A dialog pops up. Click Install. This is free, takes a few minutes, and you
   don't need the full Xcode app.)
2. Build and install:
   ```
   cd path/to/desk-timer
   ./build.sh --install
   ```
3. Open **Desk Timer** from Applications. To have it start with your Mac, add it under
   System Settings → General → Login Items.

Because you build it on your own Mac, macOS runs it without the "unidentified
developer" warning.

## Using it

- **Count up** or **Count down**. Pick one before pressing Start.
- **Length** (count down): hours and minutes, with no cap. `4` h `0` m and
  `0` h `240` m both give four hours.
- **Alarm at** (count up, optional): sounds once when you reach that time. The
  timer keeps counting afterwards.
- **Beep every N min** (either mode, optional): one short "ping" every N minutes
  of running time, counted from when you pressed Start. Time spent paused doesn't count.
- **Start / Pause / Resume** and **Reset**.
- When an alarm goes off, the chime plays 4 times and the digits flip to black on
  white until you click them or press Esc. A finished countdown sits at
  0:00:00 until you press Reset.
- The settings hide while the timer runs, so the digits can fill the window. Drag
  the window edge to make it as big as you like. It reopens where you left it and
  remembers your last settings.

Keyboard shortcuts (while the timer window is focused): **Space** starts, pauses and
resumes, **R** resets, **Esc** clears an alarm, and **⌘Q** quits.

There's no Dock icon. Use the small timer icon in the menu bar to bring the window
back if you close it, or to quit. Closing the window doesn't stop a running timer,
and an alarm brings the window back.

## Why a native Mac app

Always-on-top was the requirement that decided it:

| Option | Stays on top of other apps? |
|---|---|
| **Native Swift app (this)** | Yes. macOS lets an app set its own window level and has it join every Space, including full-screen ones. This is the same mechanism Apple's own floating panels use. |
| Electron / Tauri | Can do it (`setAlwaysOnTop`), but it bundles a whole browser engine (~150 MB with Electron) to show one clock, and it's more to keep updated. |
| HTML page in a browser | No. Pages can't set their window's level. Picture-in-Picture floats, but browsers only reliably allow it for video, and they close it or refuse to open it without a click, which is what you ran into. |
| Chrome extension | No. An extension popup closes as soon as focus leaves it. That's built into Chrome and can't be changed. |

The app is a single Swift file (`DeskTimer.swift`) with no dependencies.

## Limits to know about

- **Not yet run on a real Mac.** This was written on a Linux machine where macOS
  can't be built or run, so the first `./build.sh` is also the first compile. If it
  reports an error, paste it back and it'll be a quick fix.
- **Calibri** only comes with Microsoft Office, so it may not be installed.
  If it isn't, the timer uses the Mac's system font (San Francisco).
- **Where the sound comes out.** Chimes play through the Mac's output device (System
  Settings → Sound), which isn't necessarily the audio interface Ableton or Logic uses.
  They follow the Mac's volume, not the DAW's.
- **Full-screen apps.** The window is set to appear over full-screen apps. If
  it doesn't when your DAW is in full-screen mode, keep the DAW in a normal
  maximised window.
- While a timer is running, the app stops the Mac going to sleep from being idle, so
  alarms aren't missed. The display can still turn off.
