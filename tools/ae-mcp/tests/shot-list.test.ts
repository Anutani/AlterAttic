import { describe, it, expect } from "vitest";
import * as acorn from "acorn";
import { buildShotListScript, validatePlan, hexToRgb01, type ShotPlan } from "../src/lib/shot-list";

const plan: ShotPlan = {
  compName: "Molar_Reel",
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 6,
  background: "#0A0A0B",
  downbeats: [0, 1.8, 3.6],
  beats: [0, 0.45, 0.9, 1.35, 1.8],
  scenes: [
    { name: "S1", start: 0, end: 2, color: "#151517", title: "One" },
    { name: "S2", start: 2, end: 4, color: "#FF4D12" },
    { name: "S3", start: 4, end: 6 },
  ],
  transitions: [
    { at: 2, type: "dive", target: [540, 900] },
    { at: 4, type: "whip", direction: "up", roll: 12, flash: true },
  ],
  carrier: {
    keys: [
      { t: 0, x: 540, y: 960 },
      { t: 6, x: 540, y: 400 },
    ],
  },
};

describe("hexToRgb01", () => {
  it("parses hex with or without #", () => {
    expect(hexToRgb01("#FF4D12", [0, 0, 0])).toEqual([1, 0.302, 0.071]);
    expect(hexToRgb01("000000", [1, 1, 1])).toEqual([0, 0, 0]);
  });
  it("falls back on bad input", () => {
    expect(hexToRgb01("red", [0.5, 0.5, 0.5])).toEqual([0.5, 0.5, 0.5]);
  });
});

describe("validatePlan", () => {
  it("accepts a well-formed plan", () => {
    expect(validatePlan(plan)).toEqual([]);
  });
  it("rejects overlapping scenes and cuts that are not scene boundaries", () => {
    const bad: ShotPlan = {
      ...plan,
      scenes: [
        { name: "A", start: 0, end: 3 },
        { name: "B", start: 2, end: 6 },
      ],
      transitions: [{ at: 2.5, type: "cut" }],
    };
    const errs = validatePlan(bad);
    expect(errs.some((e) => e.includes("overlap"))).toBe(true);
    expect(errs.some((e) => e.includes("2.5"))).toBe(true);
  });
});

describe("buildShotListScript", () => {
  it("generates ES3 that parses as a function body (ExtendScript)", () => {
    const src = buildShotListScript(plan);
    expect(() => acorn.parse(`(function(){${src}})`, { ecmaVersion: 3 })).not.toThrow();
  });
  it("embeds the plan and the transition kinds", () => {
    const src = buildShotListScript(plan);
    expect(src).toContain('"compName":"Molar_Reel"');
    expect(src).toContain('x.type === "dive"');
    expect(src).toContain("CARRIER");
  });
});
