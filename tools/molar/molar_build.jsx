// Molar launch reel v1: builds the whole 30 s, 9:16 edit in After Effects.
// Shot list: /mnt/project-files/molar/molar-launch-briefs.md, section 4 (120 BPM grid).
//
// Run it with the AE MCP:   execute-script  ->  return $.evalFile("<path>/molar_build.jsx");
// or File > Scripts > Run Script File.  It never deletes anything: an existing
// "MOLAR_Master" is renamed "(old <time>)".
//
// Brand swap: everything brand-specific is in CFG below (colours, words, fonts,
// audio). Change CFG and re-run; or edit the text layers / swap the audio in AE.
// ExtendScript is ES3: no let/const, arrow functions, Array.map/forEach.

function buildMolar(over) {
    var CFG = {
        W: 1080, H: 1920, FPS: 30, DUR: 30,
        ink: "#0B0D10", panel: "#16191D", graphite: "#5C6168", enamel: "#F2EEE6", mint: "#33F0B0",
        fontBig: "ArchivoBlack-Regular",
        fontMono: "IBMPlexMono-Regular",
        fontSerif: "InstrumentSerif-Italic",
        brand: "MOLAR",                 // the O (2nd letter) is replaced by the carrier bubble
        logoWidth: 700,                 // wordmark width in px (kept small so the brand stays light)
        signoff: "FOR EVERY DENTIST",   // mono line above the wordmark
        signoffY: 820,
        tagline: "",                    // optional mono line under the wordmark (y=1120); "" = none
        words: {
            q: "Q.117 / 240", questions: "240 QUESTIONS.", plus: "+4", minus: "\u22121",
            clinic: "CLINIC BY DAY", books: "BOOKS BY NIGHT", clock: "02:47 AM",
            revision: "REVISION", thoda: "THODA AUR", mock: "ONE MORE MOCK",
            every: "STEADY HANDS", starts: "EVERY SMILE", oneMolar: "not just a dentist.",
            built: "BUILT.", strong: "STRONG.", ready: "DOCTOR."
        },
        audioPath: null,                // e.g. "C:/.../placeholder_120bpm.wav"
        savePath: null,                 // e.g. "C:/.../Molar_Reel_v1.aep"
        compName: "MOLAR_Master"
    };
    if (over) { for (var ok in over) { if (over.hasOwnProperty(ok)) CFG[ok] = over[ok]; } }

    var W = CFG.W, H = CFG.H, FPS = CFG.FPS, F = 1 / FPS, CX = W / 2, CY = H / 2;
    var P = app.project;
    var log = [];

    // ---------- helpers ----------
    function rgb(h) { h = h.replace("#", ""); var n = parseInt(h, 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
    function findItem(name, type) { for (var i = 1; i <= P.numItems; i++) { var it = P.item(i); if (it.name === name && it instanceof type) return it; } return null; }
    var FOLDER = P.items.addFolder(CFG.compName + " parts " + new Date().getTime());
    function mkComp(name, dur) { var c = P.items.addComp(name, W, H, 1, dur, FPS); c.parentFolder = FOLDER; c.bgColor = rgb(CFG.ink); c.motionBlur = true; c.shutterAngle = 180; c.motionBlurSamplesPerFrame = 16; return c; }
    function solid(c, hex, name, dur) { var l = c.layers.addSolid(rgb(hex), name, W, H, 1, dur || c.duration); l.moveToEnd(); return l; }
    function TR(l) { return l.property("ADBE Transform Group"); }
    function pos(l) { return TR(l).property("ADBE Position"); }
    function scl(l) { return TR(l).property("ADBE Scale"); }
    function rot(l) { return TR(l).property("ADBE Rotate Z"); }
    function opa(l) { return TR(l).property("ADBE Opacity"); }
    function anc(l) { return TR(l).property("ADBE Anchor Point"); }
    function pivot(l, x, y) { anc(l).setValue([x, y]); pos(l).setValue([x, y]); }

    // K(prop, [[t, value, inEase, outEase], ...]); ease = influence 1..100, 0 = linear, "h" = hold.
    function dimsOf(prop) {
        var vt = prop.propertyValueType;
        if (vt === PropertyValueType.ThreeD_SPATIAL || vt === PropertyValueType.TwoD_SPATIAL) return 1;
        if (vt === PropertyValueType.ThreeD) return 3;
        if (vt === PropertyValueType.TwoD) return 2;
        return 1;
    }
    function K(prop, keys) {
        var i;
        for (i = 0; i < keys.length; i++) prop.setValueAtTime(keys[i][0], keys[i][1]);
        var d = dimsOf(prop);
        for (i = 0; i < keys.length; i++) {
            var k = keys[i], idx = prop.nearestKeyIndex(k[0]);
            var ie = (k.length > 2) ? k[2] : 75, oe = (k.length > 3) ? k[3] : 75;
            var it = ie === "h" ? KeyframeInterpolationType.HOLD : (ie === 0 ? KeyframeInterpolationType.LINEAR : KeyframeInterpolationType.BEZIER);
            var ot = oe === "h" ? KeyframeInterpolationType.HOLD : (oe === 0 ? KeyframeInterpolationType.LINEAR : KeyframeInterpolationType.BEZIER);
            try { prop.setInterpolationTypeAtKey(idx, it, ot); } catch (e1) {}
            if (it === KeyframeInterpolationType.BEZIER || ot === KeyframeInterpolationType.BEZIER) {
                var ia = [], oa = [];
                for (var j = 0; j < d; j++) {
                    ia.push(new KeyframeEase(0, it === KeyframeInterpolationType.BEZIER ? ie : 33.33));
                    oa.push(new KeyframeEase(0, ot === KeyframeInterpolationType.BEZIER ? oe : 33.33));
                }
                try { prop.setTemporalEaseAtKey(idx, ia, oa); } catch (e2) {}
            }
            try { if (prop.isSpatial) { prop.setSpatialAutoBezierAtKey(idx, false); prop.setSpatialContinuousAtKey(idx, false); } } catch (e3) {}
        }
    }
    function S(v) { return [v, v]; }

    function txt(c, s, font, size, hex, x, y, align) {
        var l = c.layers.addText(s);
        var sp = l.property("ADBE Text Properties").property("ADBE Text Document");
        var td = sp.value;
        try { td.font = font; } catch (e) {}
        td.fontSize = size; td.applyFill = true; td.fillColor = rgb(hex); td.applyStroke = false;
        td.justification = ParagraphJustification.CENTER_JUSTIFY;
        sp.setValue(td);
        var r = l.sourceRectAtTime(0, false);
        var ax = r.left + r.width / 2;
        if (align === "l") ax = r.left; else if (align === "r") ax = r.left + r.width;
        anc(l).setValue([ax, r.top + r.height / 2]);
        pos(l).setValue([x, y]);
        l.name = s;
        return l;
    }
    // Text that slams in on t (scale 130 -> 100) and is visible t..t2.
    function slam(l, t, t2) {
        l.inPoint = t; if (t2 !== undefined) l.outPoint = t2;
        K(scl(l), [[t, S(135), 0, 0], [t + 0.2, S(100), 90, 75]]);
        return l;
    }
    function shape(c, name) { var l = c.layers.addShape(); l.name = name; pivot(l, 0, 0); return l; }
    function grp(l) { return l.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"); }
    function vecs(g) { return g.property("ADBE Vectors Group"); }
    function ellipse(l, x, y, d, fillHex, strokeHex, sw, fillOpacity) {
        var g = grp(l), v = vecs(g);
        var e = v.addProperty("ADBE Vector Shape - Ellipse");
        e.property("ADBE Vector Ellipse Size").setValue([d, d]);
        if (strokeHex) { var st = v.addProperty("ADBE Vector Graphic - Stroke"); st.property("ADBE Vector Stroke Color").setValue(rgb(strokeHex)); st.property("ADBE Vector Stroke Width").setValue(sw || 4); }
        if (fillHex) { var fl = v.addProperty("ADBE Vector Graphic - Fill"); fl.property("ADBE Vector Fill Color").setValue(rgb(fillHex)); if (fillOpacity !== undefined) fl.property("ADBE Vector Fill Opacity").setValue(fillOpacity); }
        g.property("ADBE Vector Transform Group").property("ADBE Vector Position").setValue([x, y]);
        return { group: g, size: e.property("ADBE Vector Ellipse Size") };
    }
    function rect(l, x, y, w, h, fillHex, round) {
        var g = grp(l), v = vecs(g);
        var r = v.addProperty("ADBE Vector Shape - Rect");
        r.property("ADBE Vector Rect Size").setValue([w, h]);
        if (round) r.property("ADBE Vector Rect Roundness").setValue(round);
        var fl = v.addProperty("ADBE Vector Graphic - Fill"); fl.property("ADBE Vector Fill Color").setValue(rgb(fillHex));
        g.property("ADBE Vector Transform Group").property("ADBE Vector Position").setValue([x, y]);
        return g;
    }
    // Polyline/polygon path; returns {stroke, fill, trim} props.
    function path(l, pts, closed, strokeHex, sw, fillHex, fillOpacity, withTrim) {
        var g = grp(l), v = vecs(g);
        var p = v.addProperty("ADBE Vector Shape - Group");
        var sh = new Shape(); sh.vertices = pts; sh.closed = closed;
        p.property("ADBE Vector Shape").setValue(sh);
        var out = {};
        if (withTrim) out.trim = v.addProperty("ADBE Vector Filter - Trim");
        if (strokeHex) { var st = v.addProperty("ADBE Vector Graphic - Stroke"); st.property("ADBE Vector Stroke Color").setValue(rgb(strokeHex)); st.property("ADBE Vector Stroke Width").setValue(sw || 6); try { st.property("ADBE Vector Stroke Line Join").setValue(2); st.property("ADBE Vector Stroke Line Cap").setValue(2); } catch (e) {} out.stroke = st; }
        if (fillHex) { var fl = v.addProperty("ADBE Vector Graphic - Fill"); fl.property("ADBE Vector Fill Color").setValue(rgb(fillHex)); fl.property("ADBE Vector Fill Opacity").setValue(fillOpacity === undefined ? 100 : fillOpacity); out.fill = fl; }
        // keep the trim above the graphics so it trims the path
        return out;
    }
    function ring(l, x, y, r, hex, sw) {
        var g = grp(l), v = vecs(g);
        var e = v.addProperty("ADBE Vector Shape - Ellipse"); e.property("ADBE Vector Ellipse Size").setValue([2 * r, 2 * r]);
        var tr = v.addProperty("ADBE Vector Filter - Trim");
        var st = v.addProperty("ADBE Vector Graphic - Stroke"); st.property("ADBE Vector Stroke Color").setValue(rgb(hex)); st.property("ADBE Vector Stroke Width").setValue(sw);
        g.property("ADBE Vector Transform Group").property("ADBE Vector Position").setValue([x, y]);
        return { trim: tr, size: e.property("ADBE Vector Ellipse Size"), stroke: st };
    }
    function glow(l, radius) { try { var g = l.property("ADBE Effect Parade").addProperty("ADBE Glo2"); g.property("ADBE Glo2-0003").setValue(radius || 40); g.property("ADBE Glo2-0004").setValue(1.2); } catch (e) { log.push("glow: " + e.toString()); } }
    function polyLen(pts) { var L = [0]; for (var i = 1; i < pts.length; i++) { var dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1]; L.push(L[i - 1] + Math.sqrt(dx * dx + dy * dy)); } return L; }
    function inPoly(x, y, pts) { var c = false; for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) { var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; }
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function typeOn(l, s, t0, t1) {
        var sp = l.property("ADBE Text Properties").property("ADBE Text Document");
        var td = sp.value;
        for (var i = 0; i <= s.length; i++) { td.text = (i === 0) ? " " : s.substr(0, i); sp.setValueAtTime(t0 + (t1 - t0) * i / s.length, td); }
    }

    // ---------- the molar geometry (screen px; centre 540,880; bbox ~640 x 760) ----------
    var CROWN = [[240, 640], [300, 520], [380, 610], [460, 505], [540, 600], [620, 505], [700, 610], [780, 520], [840, 640],
                 [860, 780], [830, 930], [780, 990], [540, 1010], [300, 990], [250, 930], [220, 780], [240, 640]];
    var CUSPS = [[300, 520], [460, 505], [620, 505], [780, 520]];
    var ROOT_L = [[300, 990], [420, 1005], [400, 1250], [335, 1262], [295, 1120]];
    var ROOT_R = [[660, 1005], [780, 990], [785, 1120], [745, 1262], [680, 1250]];
    var PULP = [540, 800];

    // ---------- S9: logo (built first so we know where the O sits) ----------
    var s9 = mkComp("S9 Logo", 2);
    solid(s9, CFG.ink, "BG Ink");
    var brand = CFG.brand, first = brand.substr(0, 1), rest = brand.substr(2);
    var size = 300;
    var tM = txt(s9, first, CFG.fontBig, size, CFG.enamel, 0, 0, "l");
    var tO = txt(s9, "O", CFG.fontBig, size, CFG.enamel, 0, 0, "l");
    var tR = txt(s9, rest, CFG.fontBig, size, CFG.enamel, 0, 0, "l");
    var rM = tM.sourceRectAtTime(0, false), rO = tO.sourceRectAtTime(0, false), rR = tR.sourceRectAtTime(0, false);
    var gap = size * 0.04, total = rM.width + gap + rO.width + gap + rR.width;
    var k = CFG.logoWidth / total; size = Math.round(size * k);
    tM.remove(); tO.remove(); tR.remove();
    tM = txt(s9, first, CFG.fontBig, size, CFG.enamel, 0, 0, "l");
    tO = txt(s9, "O", CFG.fontBig, size, CFG.enamel, 0, 0, "l");
    tR = txt(s9, rest, CFG.fontBig, size, CFG.enamel, 0, 0, "l");
    rM = tM.sourceRectAtTime(0, false); rO = tO.sourceRectAtTime(0, false); rR = tR.sourceRectAtTime(0, false);
    gap = size * 0.04; total = rM.width + gap + rO.width + gap + rR.width;
    var x0 = CX - total / 2;
    pos(tM).setValue([x0, CY]);
    var LO = [x0 + rM.width + gap + rO.width / 2, CY];
    var DO = Math.round(Math.min(rO.width, rO.height) * 0.92);
    tO.remove();                                    // the carrier IS the O
    pos(tR).setValue([x0 + rM.width + gap + rO.width + gap, CY]);
    var logoNull = s9.layers.addNull(); logoNull.name = "LOGO SETTLE"; pivot(logoNull, CX, CY);
    tM.parent = logoNull; tR.parent = logoNull;
    if (CFG.signoff) { var so = txt(s9, CFG.signoff, CFG.fontMono, 56, CFG.enamel, CX, CFG.signoffY); so.parent = logoNull; }
    if (CFG.tagline) { var tag = txt(s9, CFG.tagline, CFG.fontMono, 44, CFG.enamel, CX, 1120); tag.parent = logoNull; }
    K(scl(logoNull), [[0, S(101), 0, 0], [10 * F, S(100), 85, 75]]);
    log.push("L-O = " + Math.round(LO[0]) + "," + Math.round(LO[1]) + "  d=" + DO + "  brand font size " + size);

    // ---------- S1: OMR sheet (0-4 s) ----------
    var s1 = mkComp("S1 OMR sheet", 4);
    solid(s1, CFG.panel, "BG Panel");
    var sheet = shape(s1, "SHEET");
    var r, cI;
    for (r = -7; r <= 14; r++) for (cI = 0; cI < 5; cI++) ellipse(sheet, 180 + 180 * cI, CY + 150 * r, 90, null, CFG.graphite, 4);
    var fills = shape(s1, "FILLS"); fills.parent = sheet;
    for (r = 0; r < 8; r++) {
        var fe = ellipse(fills, CX, CY + 150 * r, 90, CFG.mint);
        var fo = fe.group.property("ADBE Vector Transform Group").property("ADBE Vector Group Opacity");
        K(fo, [[0, 0, "h", "h"], [r * 0.5, 100, "h", "h"]]);
    }
    // a few random "answered" bubbles in the other columns
    var other = shape(s1, "OTHER ANSWERS"); other.parent = sheet;
    for (r = -7; r <= 14; r++) { var col = Math.floor(rnd() * 5); if (col === 2) col = 3; ellipse(other, 180 + 180 * col, CY + 150 * r, 90, CFG.graphite, null, 0, 70); }
    var sk = [[0, [0, 0], "h", "h"]];
    for (r = 0; r < 7; r++) { sk.push([r * 0.5 + 0.15, [0, -150 * r], 80, 80]); sk.push([r * 0.5 + 0.45, [0, -150 * (r + 1)], 85, 80]); }
    sk.shift(); K(pos(sheet), sk);
    txt(s1, CFG.words.q, CFG.fontMono, 40, CFG.enamel, 60, 130, "l");
    slam(txt(s1, CFG.words.questions, CFG.fontBig, 110, CFG.enamel, CX, 1450), 2.0);
    slam(txt(s1, CFG.words.plus, CFG.fontMono, 90, CFG.mint, 430, 1560), 3.0);
    slam(txt(s1, CFG.words.minus, CFG.fontMono, 90, CFG.enamel, 650, 1560), 3.5);

    // ---------- S2: clinic by day (4-6 s) ----------
    var s2 = mkComp("S2 Clinic by day", 2);
    solid(s2, CFG.mint, "BG Mint");
    var lamp = shape(s2, "LAMP");
    var lr = ring(lamp, 540, 700, 170, CFG.enamel, 10);
    K(lr.trim.property("ADBE Vector Trim End"), [[0, 0, 0, 0], [20 * F, 100, 80, 60]]);
    var arm = path(lamp, [[680, 800], [860, 1010], [900, 1400], [900, 1920]], false, CFG.enamel, 10, null, 0, true);
    K(arm.trim.property("ADBE Vector Trim End"), [[3 * F, 0, 0, 0], [20 * F, 100, 80, 60]]);
    var bulb = shape(s2, "BULB (Ink)");
    var be = ellipse(bulb, 540, 700, 180, CFG.ink);
    K(be.size, [[0, [0, 0], 0, 0], [8 * F, [200, 200], 60, 60], [14 * F, [180, 180], 70, 75]]);
    slam(txt(s2, CFG.words.clinic, CFG.fontBig, 110, CFG.ink, CX, 1450), 0.5);

    // ---------- S3: books by night (6-8 s) ----------
    var s3 = mkComp("S3 Books by night", 2);
    solid(s3, CFG.ink, "BG Ink");
    var bw = [520, 600, 480, 560], bx = [540, 520, 560, 535];
    for (var b = 0; b < 4; b++) {
        var bl = shape(s3, "BOOK " + (b + 1));
        rect(bl, bx[b], 1840 - 120 * b, bw[b], 100, CFG.enamel, 6);
        bl.inPoint = b * 0.5;
        K(pos(bl), [[b * 0.5, [0, -500], 0, 0], [b * 0.5 + 0.22, [0, 0], 90, 75]]);
    }
    slam(txt(s3, CFG.words.books, CFG.fontBig, 110, CFG.enamel, CX, 1200), 0.5);
    txt(s3, CFG.words.clock, CFG.fontMono, 40, CFG.enamel, 1020, 130, "r");

    // ---------- S4 + S5: revision -> one more mock (8-14 s, one continuous comp) ----------
    var s45 = mkComp("S4-S5 Revision + One more mock", 6);
    var bg45 = solid(s45, CFG.ink, "BG Ink");
    var rush = s45.layers.addNull(); rush.name = "RUSH"; pivot(rush, CX, CY);
    function kid(l) { l.parent = rush; if (l.outPoint > 5.5) l.outPoint = 5.5; return l; }
    kid(slam(txt(s45, CFG.words.revision, CFG.fontBig, 120, CFG.enamel, CX, 600), 0));
    var nums = ["1", "2", "3"];
    var rings = shape(s45, "RINGS"); kid(rings);
    for (var nI = 0; nI < 3; nI++) {
        var tn = 0.5 + 0.5 * nI;
        var nl = kid(txt(s45, nums[nI], CFG.fontBig, 680, CFG.graphite, CX, CY));
        nl.moveToEnd(); bg45.moveToEnd(); // numerals sit just above the BG, behind everything
        slam(nl, tn, nI < 2 ? tn + 0.5 : 5.5);
        var rg = ring(rings, CX, CY, 130 + 40 * nI, CFG.mint, 6);
        K(rg.trim.property("ADBE Vector Trim End"), [[0, 0, "h", "h"], [tn, 0, 0, 0], [tn + 0.3, 100, 85, 75]]);
    }
    glow(rings, 30);
    kid(slam(txt(s45, CFG.words.thoda, CFG.fontBig, 110, CFG.enamel, CX, 1450), 2.0, 4.0));
    var bounce = [[[-120, 700], [300, 905], [-200, 520], -40], [[1200, 1250], [785, 1030], [1260, 1450], 35], [[540, -120], [540, 718], [860, -160], 25]];
    for (var bI = 0; bI < 3; bI++) {
        var tb = 2.5 + 0.5 * bI, B = bounce[bI];
        var ml = kid(txt(s45, CFG.words.minus, CFG.fontMono, 100, CFG.enamel, B[0][0], B[0][1]));
        ml.inPoint = tb; ml.outPoint = tb + 0.7;
        K(pos(ml), [[tb, B[0], 0, 0], [tb + 0.2, B[1], 0, 0], [tb + 0.65, B[2], 0, 75]]);
        K(rot(ml), [[tb + 0.2, 0, 0, 0], [tb + 0.65, B[3], 0, 75]]);
    }
    var mock = kid(txt(s45, CFG.words.mock, CFG.fontMono, 72, CFG.enamel, CX, 1450));
    mock.inPoint = 4.0; typeOn(mock, CFG.words.mock, 4.0, 4.0 + 22 * F);
    K(scl(rush), [[4.0, S(100), 0, 75], [5.0, S(140), 75, 92], [5.0 + 14 * F, S(0), 0, 0]]);

    // ---------- S6 - S8: the molar builds, one molar, stabs (14-28 s, local 0-14) ----------
    var s68 = mkComp("S6-S8 Molar", 14);
    solid(s68, CFG.ink, "BG Ink");
    var shock = shape(s68, "SHOCKWAVE");
    var sw = ring(shock, CX, CY, 10, CFG.mint, 12);
    K(sw.size, [[0, [0, 0], 0, 0], [12 * F, [2400, 2400], 90, 75]]);
    K(opa(shock), [[0, 100, 0, 0], [12 * F, 0, 0, 0]]); shock.outPoint = 0.5; glow(shock, 40);

    var tooth = s68.layers.addNull(); tooth.name = "TOOTH"; pivot(tooth, 540, 880); tooth.threeDLayer = true;
    try { anc(tooth).setValue([540, 880, 0]); pos(tooth).setValue([540, 880, 0]); } catch (eT) {}
    // bubbles burst out and land inside the crown
    function ps(p) { return [p[0], p[1], 0]; }   // TOOTH's layer space == comp space
    var land = [];
    for (var gy = 560; gy <= 980; gy += 52) for (var gx = 250; gx <= 830; gx += 52) {
        if (inPoly(gx, gy, CROWN) && inPoly(gx - 30, gy, CROWN) && inPoly(gx + 30, gy, CROWN) && inPoly(gx, gy - 30, CROWN) && inPoly(gx, gy + 30, CROWN)) land.push([gx, gy]);
    }
    var nB = Math.min(60, land.length);
    for (var q = 0; q < nB; q++) {
        var bb = shape(s68, "BUBBLE " + (q + 1));
        var isMint = (q % 2 === 0);
        ellipse(bb, 0, 0, 40, isMint ? CFG.mint : CFG.graphite);
        bb.threeDLayer = true; bb.parent = tooth;
        var ang = rnd() * Math.PI * 2, rad = 380 + rnd() * 520;
        var mid = [CX + Math.cos(ang) * rad, CY + Math.sin(ang) * rad];
        var tl = 1.0 + 0.6 * (q / nB);
        var tgt = land[q];
        K(pos(bb), [[0, ps([CX, CY]), 0, 0], [0.4, ps(mid), 90, 60], [tl, ps(tgt), 85, 75]]);
        K(scl(bb), [[0, [0, 0, 100], 0, 0], [0.1, [100, 100, 100], 70, 70]]);
    }
    log.push("bubbles landing in crown: " + nB);

    var crownL = shape(s68, "CROWN"); crownL.threeDLayer = true; crownL.parent = tooth;
    var crown = path(crownL, CROWN, true, CFG.enamel, 8, CFG.mint, 0, true);
    K(crown.trim.property("ADBE Vector Trim End"), [[0, 0, 0, 0], [2.0, 100, 0, 0]]);
    K(crown.fill.property("ADBE Vector Fill Opacity"), [[6.0, 0, 0, 0], [6.5, 35, 85, 75]]);
    glow(crownL, 35);
    var cusps = shape(s68, "CUSPS"); cusps.threeDLayer = true; cusps.parent = tooth;
    for (var cu = 0; cu < 4; cu++) {
        var ce = ellipse(cusps, CUSPS[cu][0], CUSPS[cu][1], 34, CFG.mint);
        var tc = 2.0 + 0.5 * cu;
        K(ce.size, [[0, [0, 0], "h", "h"], [tc, [0, 0], 0, 0], [tc + 4 * F, [48, 48], 60, 60], [tc + 9 * F, [34, 34], 70, 75]]);
    }
    var rootsL = [ROOT_L, ROOT_R];
    for (var ro = 0; ro < 2; ro++) {
        var rl = shape(s68, ro === 0 ? "ROOT L" : "ROOT R"); rl.threeDLayer = true; rl.parent = tooth;
        var rp = path(rl, rootsL[ro], true, CFG.enamel, 8, CFG.mint, 0, false);
        K(rp.fill.property("ADBE Vector Fill Opacity"), [[6.0, 0, 0, 0], [6.5, 35, 85, 75]]);
        var tr0 = 4.0 + ro; rl.inPoint = tr0;
        K(pos(rl), [[tr0, [0, -260, 0], 0, 0], [tr0 + 0.25, [0, 0, 0], 90, 75]]);
        glow(rl, 35);
    }
    // echo copies for the stabs (local 12, 12.5, 13)
    var echoOp = [60, 30, 10];
    for (var ec = 0; ec < 3; ec++) {
        var el = shape(s68, "ECHO " + (ec + 1)); el.threeDLayer = true; el.parent = tooth;
        path(el, CROWN, true, CFG.mint, 6, null, 0, false);
        el.inPoint = 12.0; el.outPoint = 13.5;
        var ek = [];
        for (var st = 0; st < 3; st++) { var ts = 12.0 + 0.5 * st; ek.push([ts, [0, 0, 0], "h", 0]); ek.push([ts + 0.12, [0, -30 * (ec + 1), 0], 85, "h"]); }
        K(pos(el), ek);
        var eo = [];
        for (var st2 = 0; st2 < 3; st2++) { var ts2 = 12.0 + 0.5 * st2; eo.push([ts2, echoOp[ec], 0, 0]); eo.push([ts2 + 0.4, 0, 75, "h"]); }
        K(opa(el), eo);
    }
    // orbit (subtle 3D), kick pulses from local 6, collapse into the logo O at local 13.5-14
    K(TR(tooth).property("ADBE Rotate Y"), [[4.0, 0, 0, 0], [12.0, 12, 75, 75], [13.5, 0, 75, 75]]);
    K(pos(tooth), [[13.5, [540, 880, 0], 0, 0], [14.0, [LO[0], LO[1], 0], 0, 0]]);
    K(scl(tooth), [[13.5, [100, 100, 100], 0, 92], [14.0 - F, [2, 2, 2], 0, 0]]);
    scl(tooth).expression = "var t = time, k = 0;\nif (t >= 6 && t < 12) { k = 1.5 * Math.exp(-((t - 6) % 0.5) * 12); }\n[value[0] * (1 + k / 100), value[1] * (1 + k / 100), value[2]];";
    // falling hits bounce off the crown (local 10, 10.5, 11, 11.5)
    var fx = [420, 660, 480, 600];
    for (var fh = 0; fh < 4; fh++) {
        var tf = 10.0 + 0.5 * fh, isBook = (fh % 2 === 0), side = (fh % 2 === 0) ? -1 : 1;
        var fl;
        if (isBook) { fl = shape(s68, "FALLING BOOK " + (fh + 1)); rect(fl, 0, 0, 260, 70, CFG.enamel, 6); }
        else { fl = txt(s68, CFG.words.minus, CFG.fontMono, 100, CFG.enamel, 0, 0); }
        fl.inPoint = tf; fl.outPoint = tf + 0.8;
        K(pos(fl), [[tf, [fx[fh], -150], 0, 0], [tf + 0.25, [fx[fh], 470], 0, 0], [tf + 0.75, [fx[fh] + side * 520, 180], 0, 75]]);
        K(rot(fl), [[tf + 0.25, 0, 0, 0], [tf + 0.75, side * 60, 0, 75]]);
    }
    // words
    slam(txt(s68, CFG.words.every, CFG.fontBig, 110, CFG.enamel, CX, 1500), 2.0, 4.0);
    slam(txt(s68, CFG.words.starts, CFG.fontBig, 110, CFG.enamel, CX, 1500), 4.0, 6.0);
    slam(txt(s68, CFG.words.oneMolar, CFG.fontSerif, 150, CFG.enamel, CX, 1500), 8.0, 12.0);
    slam(txt(s68, CFG.words.built, CFG.fontBig, 120, CFG.enamel, CX, 1500), 12.0, 12.5);
    slam(txt(s68, CFG.words.strong, CFG.fontBig, 120, CFG.enamel, CX, 1500), 12.5, 13.0);
    slam(txt(s68, CFG.words.ready, CFG.fontBig, 120, CFG.enamel, CX, 1500), 13.0, 13.5);

    // ---------- MASTER ----------
    var old = findItem(CFG.compName, CompItem);
    if (old) old.name = CFG.compName + " (old " + new Date().getTime() + ")";
    var M = P.items.addComp(CFG.compName, W, H, 1, CFG.DUR, FPS);
    M.bgColor = rgb(CFG.ink); M.motionBlur = true; M.shutterAngle = 180; M.motionBlurSamplesPerFrame = 16;
    solid(M, CFG.ink, "BG Ink");
    function place(c, t0, t1, name) { var l = M.layers.add(c); l.startTime = t0; l.inPoint = t0; l.outPoint = t1; l.motionBlur = true; l.name = name; return l; }
    var L1 = place(s1, 0, 4, "S1 OMR");
    var L2 = place(s2, 4, 6, "S2 Clinic");
    var L3 = place(s3, 6, 8, "S3 Books");
    var L45 = place(s45, 8, 14, "S4-S5 Revision/Mock");
    var L68 = place(s68, 14, 28, "S6-S8 Molar");
    var L9 = place(s9, 28, 30, "S9 Logo");
    // whip S3 -> S4 (f234-246): content moves up, cut mid-blur at f240
    K(pos(L3), [[7.8, [CX, CY], 85, 0], [8.0, [CX, CY - 1200], 0, 0]]);
    K(pos(L45), [[8.0, [CX, CY + 1000], 0, 0], [8.2, [CX, CY], 0, 85]]);
    L3.motionBlur = true; L45.motionBlur = true;

    // the carrier: the mint bubble, on top of every scene
    var C = M.layers.addShape(); C.name = "CARRIER (mint bubble)"; pivot(C, 0, 0);
    var ce2 = ellipse(C, 0, 0, 90, CFG.mint);
    glow(C, 45);
    C.motionBlur = true;
    var cpos = pos(C), csz = ce2.size;
    // S1: from the logo O to centre, hold, dive (d 90 -> 2400, f105-119)
    var pk = [[0, LO, "h", 75], [15 * F, [CX, CY], 85, "h"]];
    var dk = [[0, S(DO), "h", 75], [15 * F, S(90), 85, "h"], [105 * F, S(90), "h", 92], [119 * F, S(2400), 0, "h"]];
    // S2: hidden (the bulb is the inverted carrier)
    var ok2 = [[0, 100, "h", "h"], [120 * F, 0, "h", "h"], [180 * F, 100, "h", "h"]];
    // S3: moon / lamp glow at (540,700) d180, whips up and re-enters from below on S4
    pk.push([180 * F, [CX, 700], "h", "h"]); dk.push([180 * F, S(180), "h", "h"]);
    pk.push([234 * F, [CX, 700], "h", 85]); pk.push([240 * F - 0.001, [CX, 700 - 1000], 0, "h"]);
    pk.push([240 * F, [CX, CY + 1000], "h", 0]); pk.push([246 * F, [CX, CY], 85, "h"]);
    dk.push([240 * F, S(90), "h", "h"]);
    // S5 tension: d 90 -> 60 over f405-419
    dk.push([405 * F, S(90), "h", 0]); dk.push([419 * F, S(60), 0, "h"]);
    // S6: pen tip along the crown outline, f420-480, then settle into the pulp by f590
    var CL = polyLen(CROWN), total2 = CL[CL.length - 1];
    for (var v = 0; v < CROWN.length; v++) pk.push([14.0 + 2.0 * CL[v] / total2, CROWN[v], 0, 0]);
    dk.push([420 * F, S(60), "h", "h"]); dk.push([16.0, S(60), "h", 75]); dk.push([590 * F, S(90), 85, "h"]);
    pk.push([590 * F, PULP, 85, "h"]);
    // S8 -> S9: into the logo O (f825-839), then hold to the end (= frame 0, loop)
    pk.push([825 * F, PULP, "h", 92]); pk.push([839 * F, LO, 0, "h"]);
    dk.push([825 * F, S(90), "h", 92]); dk.push([839 * F, S(DO), 0, "h"]);
    K(cpos, pk); K(csz, dk); K(opa(C), ok2);
    scl(C).expression = "var t = time, k = 0;\nif (t >= 20 && t < 26) { k = 4 * Math.exp(-((t - 20) % 0.5) * 12); }\n[value[0] + k, value[1] + k];";

    // flashes (Enamel, never pure white)
    function flash(t, frames) { var f = M.layers.addSolid(rgb(CFG.enamel), "FLASH " + t, W, H, 1, CFG.DUR); f.inPoint = t; f.outPoint = t + frames * F; return f; }
    flash(178 * F, 2);
    flash(14.0, 1);

    // finishing: grain + vignette over everything
    var vig = M.layers.addSolid(rgb(CFG.ink), "VIGNETTE", W, H, 1, CFG.DUR);
    try {
        var mk = vig.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
        var ms = new Shape(); var rx = W * 0.62, ry = H * 0.58, kq = 0.5523;
        ms.vertices = [[CX, CY - ry], [CX + rx, CY], [CX, CY + ry], [CX - rx, CY]];
        ms.inTangents = [[-rx * kq, 0], [0, -ry * kq], [rx * kq, 0], [0, ry * kq]];
        ms.outTangents = [[rx * kq, 0], [0, ry * kq], [-rx * kq, 0], [0, -ry * kq]];
        ms.closed = true;
        mk.property("ADBE Mask Shape").setValue(ms); mk.inverted = true;
        mk.property("ADBE Mask Feather").setValue([380, 380]);
        opa(vig).setValue(55);
    } catch (eV) { log.push("vignette: " + eV.toString()); }
    var adj = M.layers.addSolid([1, 1, 1], "FINISH (grain)", W, H, 1, CFG.DUR); adj.adjustmentLayer = true;
    try { var nz = adj.property("ADBE Effect Parade").addProperty("ADBE Noise"); nz.property("ADBE Noise-0001").setValue(4); nz.property("ADBE Noise-0002").setValue(false); } catch (eN) { log.push("grain: " + eN.toString()); }

    // beat markers: every beat, downbeats labelled BAR n
    var mp = M.markerProperty;
    for (var bt = 0; bt < 60; bt++) { var mv = new MarkerValue(bt % 4 === 0 ? "BAR " + (bt / 4 + 1) : ""); mp.setValueAtTime(bt * 0.5, mv); }

    // audio
    var audioName = null;
    if (CFG.audioPath) {
        var af = new File(CFG.audioPath);
        if (af.exists) { var ai = P.importFile(new ImportOptions(af)); ai.parentFolder = FOLDER; var al = M.layers.add(ai); al.moveToEnd(); audioName = ai.name; }
        else log.push("audio not found: " + CFG.audioPath);
    }
    try { M.openInViewer(); } catch (eO) {}
    var saved = null;
    if (CFG.savePath) { try { P.save(new File(CFG.savePath)); saved = P.file ? P.file.fsName : CFG.savePath; } catch (eS) { log.push("save: " + eS.toString()); } }
    return { status: "success", comp: M.name, LO: [Math.round(LO[0]), Math.round(LO[1])], dO: DO, audio: audioName, saved: saved, log: log };
}

// When run with $.evalFile / Run Script File, overrides can be passed via a global MOLAR_CFG.
buildMolar(typeof MOLAR_CFG !== "undefined" ? MOLAR_CFG : null);
