# Our copy of after-effects-mcp

This folder is a copy of [a-y-ibrahim/after-effects-mcp](https://github.com/a-y-ibrahim/after-effects-mcp)
(MIT, itself built on Dakkshin/after-effects-mcp), taken at upstream commit
`e9ffbed9f675a3ac31a4295c83abfd1fb4a7b3f5` (v1.13.0, 2026-08-16). See `LICENSE` and `CREDITS.md`.

We keep it here so we can extend it for our own motion graphics workflow, starting with
camera-driven "one-take" (oner) animations in After Effects 2027 on Windows.

## Install on the editing laptop

```
cd tools/ae-mcp
npm install
npm run build
npm run install-bridge
claude mcp add AfterEffectsMCP node "<absolute path>/tools/ae-mcp/build/index.js"
```

Then in After Effects: Edit > Preferences > Scripting & Expressions > tick
"Allow Scripts to Write Files and Access Network", restart AE, and open
Window > mcp-bridge-auto.jsx (keep the panel open while working).

## Our changes

Record every change we make to upstream code here, so future upstream updates can be merged.

- **see-frame shows the real camera** (`src/scripts/mcp-bridge-auto.jsx`): the downscale step nested the
  comp with collapse transformations on, so a 3D comp rendered through the temp comp's default camera
  and every frame looked like the unmoving start. It now nests without collapsing.
- **AE outside Program Files / AE 2027+**: `aerenderCandidates` (`src/lib/bridge-core.ts`) and
  `install-bridge.js` now look for 2021 to 2028 under C:/D:/E: `Program Files\Adobe`, `D:\Software`,
  `D:\Adobe` and `E:\Software`, and honour `AE_INSTALL_DIR`. On Windows, the installer no longer gives up when
  the install folder isn't found, since it installs per user under %APPDATA% anyway.
- **New tool `build-shot-list`** (`src/lib/shot-list.ts`): a beat-timed shot list becomes a master comp
  with scenes (existing comps or placeholders), hidden-cut transitions (dive, whip, collapse, flash,
  cut), a carrier element, beat markers and the song.
- **New tool `preview-render`**: aerender to MP4, wait, then grab frames with ffmpeg (including
  2 frames either side of each cut) and return them as images. What you see is the final render.
- The bridge version is now `1.13.0-alterattic.1`. Re-run `npm run install-bridge` and reopen the panel after
  updating.
