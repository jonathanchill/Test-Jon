# Pocket Dictaphone

A single-file speech-to-text pad for a phone. Tap the red button, talk, and the
transcript builds up in an editable note you can copy straight into Claude.

Open `index.html` over **https** (or publish it as an Artifact) — microphones are
blocked on plain `http://` and on `file://` in most mobile browsers.

## What it does

- **Continuous dictation.** Mobile speech engines cut out after a few seconds of
  silence; the page restarts the recogniser automatically so a long ramble keeps
  landing in one note. Six drop-outs inside four seconds stops it and says so.
- **Spoken punctuation.** Say "full stop", "comma", "question mark", "new line",
  "new paragraph", "dash", "open quote" and they become characters. "Scratch
  that" removes the last thing you said. Toggle off if you dictate prose that
  uses those words literally.
- **Tidying.** Collapses double spaces, pulls punctuation back onto the previous
  word, and capitalises after a sentence ends.
- **Editable transcript.** It's a plain textarea — fix a misheard word by hand at
  any point, including mid-recording.
- **Copy / Share.** Copy puts the note on the clipboard; Share opens the OS share
  sheet (so you can send it to the Claude app) where the browser supports it.
- **Undo** steps back through every appended chunk and through Clear.
- **Keep screen awake** holds a Wake Lock while recording so the phone doesn't
  sleep mid-sentence.
- **15 languages**, remembered between visits along with your draft and toggles
  (`localStorage`, this device only).

## Browser support

Uses the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).

| Browser | Works |
| --- | --- |
| Safari on iOS 14.5+ | yes |
| Chrome on Android | yes |
| Chrome / Edge / Safari desktop | yes |
| Firefox (any platform) | no — the page says so and stays usable as a notepad |

Recognition itself is handled by the browser, which may send audio to the OS
vendor's service; the transcript is never sent anywhere by this page and is kept
in `localStorage` on the device.

## Files

- `index.html` — the whole tool: markup, styles and script, no build step and no
  dependencies beyond the Google Fonts stylesheet.
