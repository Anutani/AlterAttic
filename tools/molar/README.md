# Molar launch reel (After Effects build)

- `molar_build.jsx` builds the whole 30 s 9:16 reel from the director's shot list
  (molar-launch-briefs.md, section 4, dentist revision): 9 shots on a 120 BPM grid, the mint carrier bubble,
  every join (dive, flash and invert, whip, collapse, burst, collapse into the logo O, and the loop),
  beat markers ("BAR n" on downbeats), grain and vignette.
- `placeholder_120bpm.wav` is a timing-only click track (drop at 14 s, silence at 13.5 s, stabs at 26/26.5/27 s,
  final hit at 28 s). Swap in the real song by replacing the audio layer.
- Brand swap: edit `CFG` at the top of the script (colours, words, fonts, brand name) and re-run.
  Re-running never deletes anything; the old master is renamed "(old ...)".

Run from the AE MCP:

```
execute-script:  MOLAR_CFG = { audioPath: "C:/.../placeholder_120bpm.wav", savePath: "C:/.../Molar_Reel_v1.aep" };
                 return $.evalFile("C:/.../molar_build.jsx");
```

Fonts (free, Google Fonts): Archivo Black, IBM Plex Mono, Instrument Serif. Install them before running, or AE
substitutes a default font.
