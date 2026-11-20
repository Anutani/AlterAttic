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

- (none yet)
