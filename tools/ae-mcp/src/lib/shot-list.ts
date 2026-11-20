// build-shot-list: turn a beat-timed shot list into an After Effects master comp
// with hidden-cut transitions (dive, whip, collapse, flash, cut), beat markers,
// an optional "carrier" element that stays on screen across cuts, and the song.
//
// Technique notes (see tools/ae-mcp/UPSTREAM.md): the cuts are real hard cuts on
// the beat; the motion on both sides of each cut (a zoom that keeps going, a whip
// that keeps travelling, a squash to a line that re-opens) is what hides them.
//
// This module is pure: it validates/normalizes the plan and generates the
// ExtendScript (ES3) that executeScript runs inside After Effects.

export type TransitionType = "cut" | "flash" | "dive" | "whip" | "collapse";

export interface ShotPlan {
  compName: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  background: string; // hex, under every scene
  audioPath?: string;
  beats?: number[]; // seconds; become comp markers
  downbeats?: number[]; // seconds; become labelled comp markers
  scenes: Array<{
    name: string;
    start: number;
    end: number;
    comp?: string; // existing comp to use; otherwise a placeholder is created
    color?: string; // placeholder background
    title?: string; // placeholder title text
    textColor?: string;
  }>;
  transitions?: Array<{
    at: number; // the cut time (seconds), normally a downbeat
    type: TransitionType;
    duration?: number; // total seconds of motion around the cut (default 0.5)
    target?: [number, number]; // dive: the point to dive into (scene px)
    direction?: "left" | "right" | "up" | "down"; // whip
    roll?: number; // whip: extra rotation in degrees
    zoom?: number; // dive: how far the outgoing scene zooms (default 25x)
    flash?: boolean; // add a 2-frame flash on the cut
  }>;
  carrier?: {
    color?: string;
    size?: number;
    glow?: boolean;
    keys: Array<{ t: number; x: number; y: number }>;
  };
}

export function hexToRgb01(
  hex: string | undefined,
  fallback: [number, number, number],
): [number, number, number] {
  if (!hex) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  const r = Math.round((((n >> 16) & 255) / 255) * 1000) / 1000;
  const g = Math.round((((n >> 8) & 255) / 255) * 1000) / 1000;
  const b = Math.round(((n & 255) / 255) * 1000) / 1000;
  return [r, g, b];
}

/** Validate a plan; returns a list of human-readable problems (empty = OK). */
export function validatePlan(p: ShotPlan): string[] {
  const errs: string[] = [];
  if (!p.scenes || p.scenes.length === 0) errs.push("scenes: at least one scene is required");
  const sorted = [...(p.scenes || [])].sort((a, b) => a.start - b.start);
  sorted.forEach((s, i) => {
    if (!(s.end > s.start)) errs.push(`scene "${s.name}": end must be after start`);
    if (s.start < 0 || s.end > p.duration + 1e-6)
      errs.push(`scene "${s.name}": must lie within 0..${p.duration}s`);
    const next = sorted[i + 1];
    if (next && next.start < s.end - 1e-6)
      errs.push(
        `scenes "${s.name}" and "${next.name}" overlap; each scene should end where the next starts`,
      );
  });
  for (const t of p.transitions || []) {
    const hasOut = sorted.some((s) => Math.abs(s.end - t.at) < 1e-3);
    const hasIn = sorted.some((s) => Math.abs(s.start - t.at) < 1e-3);
    if (!hasOut || !hasIn)
      errs.push(
        `transition at ${t.at}s: no scene ends AND the next starts exactly there (cut times must match scene boundaries)`,
      );
  }
  return errs;
}

/** Normalize colours/defaults into the plain object literal the ExtendScript reads. */
export function planToScriptArgs(p: ShotPlan) {
  return {
    compName: p.compName,
    width: Math.round(p.width),
    height: Math.round(p.height),
    fps: p.fps,
    duration: p.duration,
    bg: hexToRgb01(p.background, [0.039, 0.039, 0.043]),
    audioPath: p.audioPath || null,
    beats: p.beats || [],
    downbeats: p.downbeats || [],
    scenes: [...p.scenes]
      .sort((a, b) => a.start - b.start)
      .map((s) => ({
        name: s.name,
        start: s.start,
        end: s.end,
        comp: s.comp || null,
        color: hexToRgb01(s.color, [0.082, 0.082, 0.09]),
        title: s.title === undefined ? s.name : s.title,
        textColor: hexToRgb01(s.textColor, [0.933, 0.914, 0.875]),
      })),
    transitions: (p.transitions || []).map((t) => ({
      at: t.at,
      type: t.type,
      duration: t.duration && t.duration > 0 ? t.duration : 0.5,
      target: t.target || null,
      direction: t.direction || "left",
      roll: t.roll || 0,
      zoom: t.zoom && t.zoom > 1 ? t.zoom : 25,
      flash: !!t.flash,
    })),
    carrier: p.carrier
      ? {
          color: hexToRgb01(p.carrier.color, [1, 0.302, 0.071]),
          size: p.carrier.size && p.carrier.size > 0 ? p.carrier.size : 28,
          glow: p.carrier.glow !== false,
          keys: [...p.carrier.keys].sort((a, b) => a.t - b.t),
        }
      : null,
  };
}

/** The ExtendScript body (ES3) executed by executeScript; `return` hands back a summary. */
export function buildShotListScript(p: ShotPlan): string {
  const A = JSON.stringify(planToScriptArgs(p));
  return `
var A = ${A};
var proj = app.project;
function findComp(n) { for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof CompItem && it.name === n) return it; } return null; }
function folder(n) { for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof FolderItem && it.name === n) return it; } return proj.items.addFolder(n); }
function easeKeys(prop, k1, k2, outInfl1, inInfl2) {
  // k1 eases OUT (slow start) when outInfl1 > 0; k2 eases IN (slow landing) when inInfl2 > 0.
  // A value of 0 leaves that side LINEAR, i.e. full speed through the cut.
  var dims = 1;
  var vt = prop.propertyValueType;
  if (vt === PropertyValueType.TwoD) dims = 2; else if (vt === PropertyValueType.ThreeD) dims = 3;
  function arr(e) { var a = []; for (var d = 0; d < dims; d++) a.push(e); return a; }
  if (outInfl1 > 0) prop.setTemporalEaseAtKey(k1, prop.keyInTemporalEase(k1), arr(new KeyframeEase(0, outInfl1)));
  else prop.setInterpolationTypeAtKey(k1, prop.keyInInterpolationType(k1), KeyframeInterpolationType.LINEAR);
  if (inInfl2 > 0) prop.setTemporalEaseAtKey(k2, arr(new KeyframeEase(0, inInfl2)), prop.keyOutTemporalEase(k2));
  else prop.setInterpolationTypeAtKey(k2, KeyframeInterpolationType.LINEAR, prop.keyOutInterpolationType(k2));
}
function anim(prop, t1, v1, t2, v2, outInfl1, inInfl2) {
  var k1 = prop.addKey(t1); prop.setValueAtKey(k1, v1);
  var k2 = prop.addKey(t2); prop.setValueAtKey(k2, v2);
  easeKeys(prop, k1, k2, outInfl1, inInfl2);
}
function tr(layer, name) { return layer.property("ADBE Transform Group").property(name); }

var W = A.width, H = A.height;
var existing = findComp(A.compName);
if (existing) existing.name = A.compName + " (old " + new Date().getTime() + ")";
var scFolder = folder(A.compName + " scenes");
var master = proj.items.addComp(A.compName, W, H, 1, A.duration, A.fps);
master.motionBlur = true;
master.shutterAngle = 360;
master.motionBlurSamplesPerFrame = 16;
var bg = master.layers.addSolid(A.bg, "BG", W, H, 1, A.duration);
bg.locked = true;

// Scenes, bottom to top in time order (later scenes above earlier ones).
var made = [], layers = [];
for (var i = 0; i < A.scenes.length; i++) {
  var s = A.scenes[i];
  var src = s.comp ? findComp(s.comp) : null;
  var placeholder = false;
  if (!src) {
    placeholder = true;
    src = proj.items.addComp(s.name, W, H, 1, (s.end - s.start) + 1, A.fps);
    src.parentFolder = scFolder;
    src.layers.addSolid(s.color, s.name + " BG", W, H, 1, src.duration);
    if (s.title) {
      var tl = src.layers.addText(s.title);
      var td = tl.property("ADBE Text Properties").property("ADBE Text Document").value;
      td.fontSize = Math.round(W * 0.11); td.fillColor = s.textColor; td.justification = ParagraphJustification.CENTER_JUSTIFY;
      tl.property("ADBE Text Properties").property("ADBE Text Document").setValue(td);
      var r = tl.sourceRectAtTime(0, false);
      tr(tl, "ADBE Anchor Point").setValue([r.left + r.width / 2, r.top + r.height / 2]);
      tr(tl, "ADBE Position").setValue([W / 2, H / 2]);
    }
  }
  var L = master.layers.add(src);
  L.startTime = s.start;
  L.inPoint = s.start;
  L.outPoint = s.end;
  L.motionBlur = true;
  L.name = s.name;
  layers.push(L);
  made.push({ name: s.name, comp: src.name, placeholder: placeholder, start: s.start, end: s.end });
}
function layerEndingAt(t) { for (var i = 0; i < A.scenes.length; i++) if (Math.abs(A.scenes[i].end - t) < 0.001) return layers[i]; return null; }
function layerStartingAt(t) { for (var i = 0; i < A.scenes.length; i++) if (Math.abs(A.scenes[i].start - t) < 0.001) return layers[i]; return null; }

var done = [];
for (var j = 0; j < A.transitions.length; j++) {
  var x = A.transitions[j];
  var outL = layerEndingAt(x.at), inL = layerStartingAt(x.at);
  if (!outL || !inL) { done.push({ at: x.at, type: x.type, skipped: "no scene boundary here" }); continue; }
  var h = x.duration / 2, t = x.at;
  if (x.type === "dive") {
    var tgt = x.target || [W / 2, H / 2];
    tr(outL, "ADBE Anchor Point").setValue([tgt[0], tgt[1]]);
    tr(outL, "ADBE Position").setValue([tgt[0], tgt[1]]);
    anim(tr(outL, "ADBE Scale"), t - h, [100, 100, 100], t, [100 * x.zoom, 100 * x.zoom, 100], 85, 0);
    anim(tr(inL, "ADBE Scale"), t, [35, 35, 100], t + h, [100, 100, 100], 0, 85);
  } else if (x.type === "whip") {
    var dx = 0, dy = 0;
    if (x.direction === "left") dx = -1; else if (x.direction === "right") dx = 1; else if (x.direction === "up") dy = -1; else dy = 1;
    var c = [W / 2, H / 2];
    anim(tr(outL, "ADBE Position"), t - h, c, t, [c[0] + dx * W, c[1] + dy * H], 80, 0);
    anim(tr(inL, "ADBE Position"), t, [c[0] - dx * W, c[1] - dy * H], t + h, c, 0, 80);
    if (x.roll) {
      anim(tr(outL, "ADBE Rotate Z"), t - h, 0, t, x.roll, 80, 0);
      anim(tr(inL, "ADBE Rotate Z"), t, -x.roll, t + h, 0, 0, 80);
    }
  } else if (x.type === "collapse") {
    anim(tr(outL, "ADBE Scale"), t - h, [100, 100, 100], t, [112, 0.6, 100], 85, 0);
    anim(tr(inL, "ADBE Scale"), t, [112, 0.6, 100], t + h, [100, 100, 100], 0, 85);
  }
  if (x.flash || x.type === "flash") {
    var f = master.layers.addSolid([0.933, 0.914, 0.875], "FLASH " + t, W, H, 1, 2 / A.fps);
    f.startTime = t; f.inPoint = t; f.outPoint = t + 2 / A.fps;
  }
  done.push({ at: t, type: x.type });
}

// The carrier: one element that stays on screen across every cut.
var carrierInfo = null;
if (A.carrier && A.carrier.keys.length) {
  var sh = master.layers.addShape();
  sh.name = "CARRIER";
  var grp = sh.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
  var vg = grp.property("ADBE Vectors Group");
  var el = vg.addProperty("ADBE Vector Shape - Ellipse");
  el.property("ADBE Vector Ellipse Size").setValue([A.carrier.size, A.carrier.size]);
  var fl = vg.addProperty("ADBE Vector Graphic - Fill");
  fl.property("ADBE Vector Fill Color").setValue(A.carrier.color);
  var pos = tr(sh, "ADBE Position");
  for (var k = 0; k < A.carrier.keys.length; k++) pos.setValueAtTime(A.carrier.keys[k].t, [A.carrier.keys[k].x, A.carrier.keys[k].y]);
  sh.motionBlur = true;
  if (A.carrier.glow) { try { var gl = sh.property("ADBE Effect Parade").addProperty("ADBE Glo2"); gl.property("ADBE Glo2-0003").setValue(40); } catch (ge) {} }
  carrierInfo = { keys: A.carrier.keys.length };
}

// Beat markers on the master comp.
var mk = master.markerProperty;
var db = {};
for (var b = 0; b < A.downbeats.length; b++) { db[Math.round(A.downbeats[b] * 1000)] = true; mk.setValueAtTime(A.downbeats[b], new MarkerValue("DB " + (b + 1))); }
for (var b2 = 0; b2 < A.beats.length; b2++) { if (!db[Math.round(A.beats[b2] * 1000)]) mk.setValueAtTime(A.beats[b2], new MarkerValue("")); }

// The song.
var audio = null;
if (A.audioPath) {
  var af = new File(A.audioPath);
  if (af.exists) { var ai = proj.importFile(new ImportOptions(af)); ai.parentFolder = scFolder; var al = master.layers.add(ai); al.moveToEnd(); audio = ai.name; }
  else audio = "NOT FOUND: " + A.audioPath;
}
try { master.openInViewer(); } catch (ve) {}
return { status: "success", comp: master.name, size: [W, H], fps: A.fps, duration: A.duration, scenes: made, transitions: done, carrier: carrierInfo, markers: A.downbeats.length + A.beats.length, audio: audio };
`;
}
