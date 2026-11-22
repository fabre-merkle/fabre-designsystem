"use client";
import { Card, type CardProps } from "@workspace/ui/components/card";
import { SurfaceLevel } from "@workspace/ui/components/elevated";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { type Leader, leaderLine, placeColumn } from "./card-annotated-layout";
import { cardLayers, tokenNames } from "./card-annotated-model";
import "./card-annotated.css";

type Side = "left" | "right";
type Which = "card" | "nested";

type Reading = {
  /** The value printed in the callout head. */
  value: string;
  /** The custom property the part paints with. */
  token: string;
  note?: ReactNode;
};

type Spec = {
  id: string;
  side: Side;
  which: Which;
  /** Where the line meets the part's edge, as a fraction of its height from the top. */
  at: number;
  label: string;
  read: (m: Measured) => Reading;
};

type Measured = {
  card: { level: number; edge: number; shadow: number; radius: number };
  nested: { level: number; edge: number; shadow: number; radius: number };
  concentric: number;
  minimum: number;
};

const px = (v: number) => `${Math.round(v * 100) / 100}px`;
const num = (v: string) => Number.parseFloat(v) || 0;

const SPECS: Spec[] = [
  {
    id: "card-corner",
    side: "left",
    which: "card",
    at: 0.06,
    label: "Card corner",
    read: (m) => ({ value: px(m.card.radius), token: "--radius-default" }),
  },
  {
    id: "card-fill",
    side: "left",
    which: "card",
    at: 0.3,
    label: "Card fill",
    read: (m) => ({ value: `level ${m.card.level}`, token: tokenNames.fill(m.card.level) }),
  },
  {
    id: "card-edge",
    side: "left",
    which: "card",
    at: 0.58,
    label: "Card edge",
    read: (m) => ({ value: `level ${m.card.edge}`, token: tokenNames.edge(m.card.edge) }),
  },
  {
    id: "card-shadow",
    side: "left",
    which: "card",
    at: 0.94,
    label: "Card shadow",
    read: (m) => ({ value: `level ${m.card.shadow}`, token: tokenNames.shadow(m.card.shadow) }),
  },
  {
    id: "nested-corner",
    side: "right",
    which: "nested",
    at: 0.06,
    label: "Nested corner",
    read: (m) => ({
      value: px(m.nested.radius),
      token: "--inner-radius",
      note: (
        <>
          Concentric {px(m.concentric)}, inset minimum {px(m.minimum)}. Used {px(m.nested.radius)}.
        </>
      ),
    }),
  },
  {
    id: "nested-fill",
    side: "right",
    which: "nested",
    at: 0.36,
    label: "Nested fill",
    read: (m) => ({ value: `level ${m.nested.level}`, token: tokenNames.fill(m.nested.level) }),
  },
  {
    id: "nested-edge",
    side: "right",
    which: "nested",
    at: 0.66,
    label: "Nested edge",
    read: (m) => ({ value: `level ${m.nested.edge}`, token: tokenNames.edge(m.nested.edge) }),
  },
  {
    id: "nested-shadow",
    side: "right",
    which: "nested",
    at: 0.96,
    label: "Nested shadow",
    read: (m) => ({
      value: `level ${m.nested.shadow}`,
      token: tokenNames.shadow(m.nested.shadow),
      note: "Nesting never raises the shadow level.",
    }),
  },
];

export type CardAnnotatedProps = {
  /** Pin the card's surface level. Without it the card sits on the page and lands on level 3. */
  level?: CardProps["level"];
  /** The card's shadow level. */
  shadowLevel?: NonNullable<CardProps["shadowLevel"]>;
};

type Placed = Leader & { id: string };

/**
 * One Card with a nested Card, and a callout for each part naming the token Elevated applied:
 * fill, edge, shadow and corner. Every value is read from the rendered cards, so it follows the
 * levels, the brand and the theme.
 */
export function CardAnnotated({ level, shadowLevel = 1 }: CardAnnotatedProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const [tops, setTops] = useState<Record<string, number>>({});
  const [lines, setLines] = useState<Placed[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: SPECS is module-constant; re-read when the levels change
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const read = () => {
      const [outer, inner] = [...root.querySelectorAll<HTMLElement>('[data-ui="card"]')];
      if (!(outer && inner)) return;
      // The leader SVG sits inside `.ca-grid`, so measure from the grid, not the padded root.
      const grid = root.querySelector<HTMLElement>(".ca-grid");
      if (!grid) return;
      const box = grid.getBoundingClientRect();
      const outerStyle = getComputedStyle(outer);
      const layer = (el: HTMLElement) => ({
        level: Number(el.dataset.surfaceLevel),
        edge: Math.min(8, Number(el.dataset.surfaceLevel) + 1),
        shadow: Number(el.dataset.shadowLevel),
        radius: num(getComputedStyle(el).borderTopLeftRadius),
      });
      // A custom property reads back unresolved, so measure it as a length instead.
      const probe = document.createElement("span");
      probe.style.cssText =
        "position:absolute;visibility:hidden;inline-size:var(--radius-inset-minimum)";
      root.append(probe);
      const minimum = probe.getBoundingClientRect().width;
      probe.remove();
      const m: Measured = {
        card: layer(outer),
        nested: layer(inner),
        concentric: Math.max(
          0,
          num(outerStyle.borderTopLeftRadius) -
            num(outerStyle.borderTopWidth) -
            num(outerStyle.paddingTop),
        ),
        minimum,
      };
      setMeasured((prev) => (prev && JSON.stringify(prev) === JSON.stringify(m) ? prev : m));

      const targets = { card: outer, nested: inner };
      const anchors: Record<string, [number, number]> = {};
      for (const s of SPECS) {
        const r = targets[s.which].getBoundingClientRect();
        anchors[s.id] = [
          (s.side === "left" ? r.left : r.right) - box.left,
          r.top + r.height * s.at - box.top,
        ];
      }
      const nextTops: Record<string, number> = {};
      const nextLines: Placed[] = [];
      for (const side of ["left", "right"] as const) {
        const col = root.querySelector<HTMLElement>(`.ca-callouts[data-side="${side}"]`);
        if (!col || getComputedStyle(col).display === "flex") continue;
        const cr = col.getBoundingClientRect();
        const items = SPECS.filter((s) => s.side === side).map((s) => ({
          id: s.id,
          want: anchors[s.id][1] - (cr.top - box.top),
          h: root.querySelector<HTMLElement>(`[data-callout="${s.id}"]`)?.offsetHeight ?? 0,
        }));
        const placed = placeColumn(items, cr.height);
        for (const it of items) {
          nextTops[it.id] = placed[it.id];
          nextLines.push({
            id: it.id,
            ...leaderLine({
              side,
              x: (side === "left" ? cr.right : cr.left) - box.left,
              top: cr.top - box.top + placed[it.id],
              h: it.h,
              anchor: anchors[it.id],
            }),
          });
        }
      }
      setTops(nextTops);
      setLines(nextLines);
    };
    read();
    // The token styles and the theme settle after the first render, so read a few times.
    const timers = [60, 250, 800].map((ms) => window.setTimeout(read, ms));
    const resize = new ResizeObserver(read);
    resize.observe(root);
    const theme = new MutationObserver(() => window.setTimeout(read, 60));
    theme.observe(document.documentElement, { attributes: true });
    return () => {
      for (const t of timers) window.clearTimeout(t);
      resize.disconnect();
      theme.disconnect();
    };
  }, [level, shadowLevel, measured === null]);

  // The levels before the cards have been measured, so the first paint already names them.
  const fallback = cardLayers(level ?? 3, shadowLevel);
  const m: Measured = measured ?? {
    card: { ...fallback.card, radius: 0 },
    nested: { ...fallback.nested, radius: 0 },
    concentric: 0,
    minimum: 0,
  };

  const column = (side: Side) => (
    <div className="ca-callouts" data-side={side}>
      {SPECS.filter((s) => s.side === side).map((s) => {
        const r = s.read(m);
        return (
          <div
            key={s.id}
            className="ca-callout"
            data-callout={s.id}
            style={{ top: tops[s.id] ?? 0 }}
          >
            <div className="ca-head">
              <strong>{s.label}</strong>
              <span className="ca-value">{r.value}</span>
            </div>
            <code className="ca-token">{r.token}</code>
            {r.note ? <p>{r.note}</p> : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div data-focus-island>
      <div ref={rootRef} data-card-annotated>
        <div className="ca-grid">
          {column("left")}
          <div className="ca-subject">
            <SurfaceLevel level={1}>
              <Card.Root level={level} shadowLevel={shadowLevel}>
                <Card.Header>
                  <Card.Title>Billing</Card.Title>
                  <Card.Description>Plan, seats and invoices.</Card.Description>
                </Card.Header>
                <Card.Content>
                  <Card.Root size="sm">
                    <Card.Header>
                      <Card.Title>Team plan</Card.Title>
                      <Card.Description>12 seats, renews 1 March.</Card.Description>
                    </Card.Header>
                  </Card.Root>
                </Card.Content>
              </Card.Root>
            </SurfaceLevel>
          </div>
          {column("right")}
          <svg className="ca-leaders" aria-hidden="true" focusable="false">
            {lines.map((l) => (
              <g key={l.id}>
                <path d={l.d} />
                <circle cx={l.from[0]} cy={l.from[1]} r="2.5" />
                <circle cx={l.to[0]} cy={l.to[1]} r="2.5" />
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
