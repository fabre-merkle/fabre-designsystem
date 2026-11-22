// Pure layout maths for the annotated Card: where each callout sits in its column and the leader
// line that joins it to its element. No DOM, so it is unit-tested.

/** Space kept between two callouts in a column. */
export const CALLOUT_GAP = 12;
/** How far a bent leader line runs in the gutter before it turns. */
export const ELBOW = 12;
/** Inset from a callout's top and bottom inside which a line may leave it. */
export const EDGE = 4;

export type PlaceItem = {
  id: string;
  /** Where the callout's centre wants to be (the anchor's y, relative to the column). */
  want: number;
  /** The callout's height. */
  h: number;
};

/**
 * Callout tops for one column: each as near its anchor as it can get without overlapping.
 * When a callout is pushed down by the one above, that one moves up first, as far as it can
 * while its own anchor stays within its height, so both lines can stay straight.
 */
export function placeColumn(items: PlaceItem[], height: number): Record<string, number> {
  const sorted = [...items].sort((a, b) => a.want - b.want);
  const tops: number[] = [];
  sorted.forEach((it, i) => {
    let top = it.want - it.h / 2;
    if (i > 0) {
      const prev = sorted[i - 1];
      let floor = tops[i - 1] + prev.h + CALLOUT_GAP;
      if (top < floor) {
        const prevFloor = i > 1 ? tops[i - 2] + sorted[i - 2].h + CALLOUT_GAP : 0;
        const prevMin = Math.max(prevFloor, prev.want - prev.h + EDGE);
        const shift = Math.max(0, Math.min(floor - top, tops[i - 1] - prevMin));
        tops[i - 1] -= shift;
        floor -= shift;
        top = Math.max(top, floor);
      }
    }
    tops.push(top);
  });
  for (let i = sorted.length - 1; i >= 0; i--) {
    const ceil =
      i === sorted.length - 1 ? height - sorted[i].h : tops[i + 1] - CALLOUT_GAP - sorted[i].h;
    tops[i] = Math.max(0, Math.min(tops[i], ceil));
  }
  return Object.fromEntries(sorted.map((it, i) => [it.id, tops[i]]));
}

export type Leader = { from: [number, number]; to: [number, number]; d: string };

/**
 * The line from a callout's inner edge (`x`) to its anchor. It leaves the callout level with
 * the anchor wherever the callout's height allows, so it is a single straight run; otherwise
 * it takes one bend in the gutter.
 */
export function leaderLine(args: {
  side: "left" | "right";
  /** x of the callout edge facing the subject. */
  x: number;
  /** y of the callout's top. */
  top: number;
  /** The callout's height. */
  h: number;
  anchor: [number, number];
}): Leader {
  const { side, x, top, h, anchor } = args;
  const y = Math.min(Math.max(anchor[1], top + EDGE), top + h - EDGE);
  const straight = Math.abs(y - anchor[1]) < 1;
  const elbow = side === "left" ? x + ELBOW : x - ELBOW;
  return {
    from: [x, straight ? anchor[1] : y],
    to: anchor,
    d: straight
      ? `M${x},${anchor[1]} H${anchor[0]}`
      : `M${x},${y} H${elbow} V${anchor[1]} H${anchor[0]}`,
  };
}
