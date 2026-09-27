# Desk Timer

A Mac timer that stays on top of Ableton, Logic or anything else. It's drawn as an
old-school seven-segment LED clock: white segments on black, with the unlit segments
showing faintly behind the lit ones. It can count up or count down, sound an alarm,
and beep at intervals you choose.

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

**Setup screen** (shown at launch and after Reset):
- **▼ COUNT DOWN / ▲ COUNT UP** switch at the top.
- Set the time on the clock face. ▲/▼ above and below the digits change the hours
  by 1 and the minutes by 5. To type an exact number, click the digits (a bar
  appears under them), type, then press Return, or Tab to move from hours to minutes.
  You can go up to 99 hours 59 minutes.
- In count up, the same digits set **Alarm at**. Its switch turns the alarm on or
  off. The alarm sounds once and the clock keeps counting.
- **Beep every**: switch, then −/+ in 5-minute steps, or click the digits to type
  any number of minutes. One short ping every N minutes of running time. Time spent
  paused doesn't count.
- **START**, or press Space or Return.

**Running screen**: large digits with indicator lamps underneath (▼ DOWN, ▲ UP,
ALARM, BEEP, PAUSED). Pausing dims the digits and switches the colons off. When an
alarm goes off, the chime plays 4 times and the display lights up white with black
digits until you click it or press Esc. Drag the window edge to make the digits
bigger. The setup and running screens each remember their own window size, and the
app remembers your last settings.

Keyboard shortcuts: **Space** starts, pauses and resumes, **R** resets, **Esc**
clears an alarm, and **⌘Q** quits.

**Closing the window (the red button) quits the app.** There's no Dock icon. The
small timer icon in the menu bar can also bring the window forward, or quit.

## Why a native Mac app

Always-on-top was the requirement that decided it:

| Option | Stays on top of other apps? |
|---|---|
| **Native Swift app (this)** | Yes. macOS lets an app set its own window level and has it join every Space, including full-screen ones. This is the same mechanism Apple's own floating panels use. |
| Electron / Tauri | Can do it (`setAlwaysOnTop`), but it bundles a whole browser engine (~150 MB with Electron) to show one clock, and it's more to keep updated. |
| HTML page in a browser | No. Pages can't set their window's level. Picture-in-Picture floats, but browsers only reliably allow it for video, and they close it or refuse to open it without a click, which is what you ran into. |
| Chrome extension | No. An extension popup closes as soon as focus leaves it. That's built into Chrome and can't be changed. |

The app is a single Swift file (`DeskTimer.swift`) with no dependencies. The label
font, Share Tech Mono, is bundled from `Resources/` under its open font licence
(`Resources/OFL.txt`).

## Limits to know about

- **Built without a Mac to test on.** This code is written on a Linux machine, so
  each change is first compiled when you run `./build.sh`. If it reports an error,
  paste it back.
- **Where the sound comes out.** Chimes play through the Mac's output device (System
  Settings → Sound), which isn't necessarily the audio interface Ableton or Logic uses.
  They follow the Mac's volume, not the DAW's.
- **Full-screen apps.** The window is set to appear over full-screen apps. If
  it doesn't when your DAW is in full-screen mode, keep the DAW in a normal
  maximised window.
- While a timer is running, the app stops the Mac going to sleep from being idle, so
  alarms aren't missed. The display can still turn off.
