// Half-court geometry in feet. x runs sideline to sideline (-25..25),
// y runs from the baseline (0) to half court (47). The hoop sits at (0, 5.25).
export const HOOP = [0, 5.25];
export const THREE_RADIUS = 23.75;
export const CORNER_THREE_X = 22;
export const CORNER_THREE_MAX_Y = 14;

export const ZONES = ["RA", "PAINT", "MID", "CORNER3", "ATB3"];
export const ZONE_LABELS = {
  RA: "Restricted area",
  PAINT: "Paint",
  MID: "Mid-range",
  CORNER3: "Corner 3",
  ATB3: "Above-the-break 3",
};

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Which of the five shot zones a floor position falls in. */
export function zoneOf([x, y]) {
  const d = dist([x, y], HOOP);
  if (d <= 4) return "RA";
  if (Math.abs(x) >= CORNER_THREE_X && y <= CORNER_THREE_MAX_Y) return "CORNER3";
  if (d >= THREE_RADIUS && y > CORNER_THREE_MAX_Y) return "ATB3";
  if (Math.abs(x) <= 8 && y <= 19) return "PAINT";
  return "MID";
}

export const pointsFor = (zone) => (zone === "CORNER3" || zone === "ATB3" ? 3 : 2);
