# Third-party licenses (`vendor/`)

holyfret self-hosts two third-party assets in this folder. Both are free to
redistribute; their license notices are kept alongside them, as required.

## abcjs — `abcjs-basic-min.js`

- **Version:** abcjs_basic v6.4.4
- **Copyright:** © 2009-2024 Paul Rosen and Gregory Dyke (https://abcjs.net)
- **License:** MIT — full text in [`abcjs-LICENSE.txt`](abcjs-LICENSE.txt)
- **Used for:** rendering sheet-music notation (`ABCJS.renderAbc`). The MIDI/synth
  part is never called, so no soundfont is fetched.
- **Obligation:** keep the copyright + permission notice with the file (done).

## Karla — `karla-latin.woff2`

- **Copyright:** Copyright 2019 The Karla Project Authors
  (https://github.com/googlefonts/karla)
- **License:** SIL Open Font License 1.1 — full text in [`karla-OFL.txt`](karla-OFL.txt)
- **Used for:** the UI typeface (latin subset, variable weight 400–700).
- **Obligations under OFL 1.1:** keep the copyright notice + this license with the
  font (done); do not sell the font by itself; a Modified Version may not use a
  Reserved Font Name (Karla declares none). Bundling/embedding it in this app —
  including inlined as a data URI in `standalone.html` — is expressly allowed.

Neither license conflicts with releasing holyfret's own code under the MIT
License (see the repo `LICENSE`).
