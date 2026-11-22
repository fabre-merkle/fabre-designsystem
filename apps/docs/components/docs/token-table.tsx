"use client";

import { useCopyButton } from "fumadocs-ui/utils/use-copy-button";
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { DocumentationToken, TokenReferenceData } from "../../lib/design-tokens";
import { useExampleComponents } from "./foundation-examples";
import { cssTokenName, tokenGroupId } from "./token-name";

function CopyToken({ name }: { name: string }) {
  const [error, setError] = useState(false);
  const [copied, markCopied] = useCopyButton(() => {});
  async function copy(event: MouseEvent<HTMLButtonElement>) {
    setError(false);
    try {
      await navigator.clipboard.writeText(name);
      markCopied(event);
    } catch {
      setError(true);
    }
  }
  return (
    <>
      <button
        className="docs-token-copy"
        type="button"
        onClick={copy}
        aria-label={`${copied ? "Copied" : "Copy"} ${name}`}
        title={copied ? "Copied" : "Copy token"}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          {copied ? (
            <path d="m3 8 3 3 7-7" />
          ) : (
            <>
              <rect x="5" y="5" width="8" height="9" rx="1.5" />
              <path d="M3 11H2.5A1.5 1.5 0 0 1 1 9.5v-6A1.5 1.5 0 0 1 2.5 2h6A1.5 1.5 0 0 1 10 3.5V4" />
            </>
          )}
        </svg>
      </button>
      {error ? <span role="alert">Could not copy token.</span> : null}
    </>
  );
}

function MotionPreview({ row, variable }: { row: DocumentationToken; variable: string }) {
  const [played, setPlayed] = useState(false);
  const style: CSSProperties = {
    transform: played ? "translateX(24px)" : "translateX(0)",
    transitionDuration: row.type === "duration" ? `var(${variable})` : "500ms",
    transitionTimingFunction: row.type === "cubicBezier" ? `var(${variable})` : "ease",
  };
  return (
    <button
      type="button"
      className="docs-token-motion"
      aria-label={`Play ${row.name}`}
      onClick={() => setPlayed((previous) => !previous)}
    >
      <span style={style} />
    </button>
  );
}

function isNonvisual(row: DocumentationToken) {
  return /^(?:brand\.)?(?:breakpoint\.|z-index\.|shadow\.headroom$)/.test(row.name);
}

function NoVisualPreview() {
  return (
    <span className="docs-token-na" title="No visual preview available">
      <span aria-hidden="true">N/A</span>
      <span className="sr-only">No visual preview available</span>
    </span>
  );
}

function Preview({ row, resolvedValue }: { row: DocumentationToken; resolvedValue?: string }) {
  const variable = cssTokenName(row.name);
  const value = resolvedValue === undefined ? `var(${variable})` : resolvedValue;
  if (isNonvisual(row)) return <NoVisualPreview />;
  if (row.type === "color") {
    return <span aria-hidden className="docs-token-swatch" style={{ background: value }} />;
  }
  if (row.type === "shadow") {
    return <span aria-hidden className="docs-token-shadow" style={{ boxShadow: value }} />;
  }
  if (row.type === "gradient") {
    return <span aria-hidden className="docs-token-swatch" style={{ backgroundImage: value }} />;
  }
  if (row.type === "border") {
    return <span aria-hidden className="docs-token-stroke" style={{ border: value }} />;
  }
  if (/(?:^|[.-])radius(?:[.-]|$)/.test(row.name)) {
    return <span aria-hidden className="docs-token-radius" style={{ borderRadius: value }} />;
  }
  if (/(?:^|[.-])(?:stroke-width|border-width)(?:[.-]|$)/.test(row.name)) {
    return <span aria-hidden className="docs-token-stroke" style={{ borderWidth: value }} />;
  }
  if (row.type === "duration" || row.type === "cubicBezier") {
    return <MotionPreview row={row} variable={variable} />;
  }
  if (row.type === "opacity") {
    return <span aria-hidden className="docs-token-opacity" style={{ opacity: value }} />;
  }
  if (/^(?:brand\.blur\.|backdrop\.[^.]+\.blur$)/.test(row.name)) {
    return (
      <span aria-hidden className="docs-token-filter">
        <span style={{ backdropFilter: `blur(${value})` }} />
      </span>
    );
  }
  if (/^(?:brand\.saturate\.|backdrop\.[^.]+\.saturate$)/.test(row.name)) {
    return (
      <span aria-hidden className="docs-token-filter">
        <span style={{ backdropFilter: `saturate(${value})` }} />
      </span>
    );
  }
  if (row.type === "typography") {
    return (
      <span
        aria-hidden
        className="docs-token-type"
        style={{
          fontFamily: `var(${variable}-font-family)`,
          fontWeight: `var(${variable}-font-weight)`,
        }}
      >
        Aa
      </span>
    );
  }
  if (row.type === "fontFamily") {
    return (
      <span aria-hidden className="docs-token-type" style={{ fontFamily: value }}>
        Aa
      </span>
    );
  }
  if (row.type === "fontWeight") {
    return (
      <span aria-hidden className="docs-token-type" style={{ fontWeight: value }}>
        Aa
      </span>
    );
  }
  if (row.type === "letterSpacing") {
    return (
      <span aria-hidden className="docs-token-type" style={{ letterSpacing: value }}>
        Aa
      </span>
    );
  }
  if (row.type === "lineHeight") {
    return (
      <span
        aria-hidden
        className="docs-token-type docs-token-line-height"
        style={{ lineHeight: value }}
      >
        Aa
        <br />
        Aa
      </span>
    );
  }
  if (
    row.type === "fontSize" ||
    (row.type === "dimension" &&
      (/^(?:brand\.)?typography\..*\.size$/.test(row.name) || /\.fontSize$/.test(row.name)))
  ) {
    return (
      <span aria-hidden className="docs-token-type" style={{ fontSize: `min(${value}, 2rem)` }}>
        A
      </span>
    );
  }
  if (row.type === "dimension") {
    return <span aria-hidden className="docs-token-measure" style={{ width: value }} />;
  }
  return <NoVisualPreview />;
}

function propertyFor(row: DocumentationToken): string | undefined {
  if (row.type === "color") return "color";
  if (row.type === "shadow") return "box-shadow";
  if (row.type === "gradient") return "background-image";
  if (row.type === "border") return "border";
  if (row.type === "dimension" || row.type === "fontSize" || row.name.endsWith(".blur")) {
    return "margin-left";
  }
  if (row.type === "duration") return "transition-duration";
  if (row.type === "cubicBezier") return "transition-timing-function";
  if (row.type === "opacity") return "opacity";
  if (row.type === "fontFamily") return "font-family";
  if (row.type === "fontWeight") return "font-weight";
  if (row.type === "letterSpacing") return "letter-spacing";
  if (row.type === "lineHeight") return "line-height";
  return undefined;
}

function readValues(scope: HTMLElement, rows: DocumentationToken[]): Record<string, string> {
  const variables = getComputedStyle(scope);
  const probes = document.createElement("div");
  probes.className = "docs-token-probes";
  const jobs = rows.map((row) => {
    const probe = document.createElement("span");
    const variable = cssTokenName(row.name);
    const property = propertyFor(row);
    if (row.type === "typography") {
      for (const part of [
        "font-family",
        "font-size",
        "font-weight",
        "line-height",
        "letter-spacing",
      ]) {
        probe.style.setProperty(part, `var(${variable}-${part})`);
      }
    } else if (property) {
      probe.style.setProperty(property, `var(${variable})`);
    }
    probes.appendChild(probe);
    return { row, probe, variable, property };
  });
  scope.appendChild(probes);
  const values: Record<string, string> = {};
  for (const { row, probe, variable, property } of jobs) {
    if (row.type === "typography") {
      const parts = ["font-family", "font-size", "font-weight", "line-height", "letter-spacing"];
      if (parts.every((part) => variables.getPropertyValue(`${variable}-${part}`).trim())) {
        const computed = getComputedStyle(probe);
        values[row.name] = parts.map((part) => computed.getPropertyValue(part).trim()).join(" · ");
      }
    } else {
      const raw = variables.getPropertyValue(variable).trim();
      if (raw) {
        values[row.name] = property
          ? getComputedStyle(probe).getPropertyValue(property).trim()
          : raw;
      }
    }
  }
  probes.remove();
  return values;
}

function shadowLayers(value: string): string[] {
  let depth = 0;
  let start = 0;
  const layers: string[] = [];
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "(") depth++;
    else if (value[index] === ")") depth--;
    else if (value[index] === "," && depth === 0) {
      layers.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  layers.push(value.slice(start).trim());
  return layers;
}

function Value({ value }: { value?: string }) {
  if (value === undefined) return <span>Resolving active value…</span>;
  if (!value) return <span className="docs-token-na">Not available</span>;
  return <code>{value}</code>;
}

function TokenRow({
  row,
  semantic,
  value,
  modeValues,
  modePaint,
  brand,
  web,
  unavailable,
}: {
  row: DocumentationToken;
  semantic: boolean;
  value?: string;
  modeValues?: { light?: string; dark?: string };
  modePaint: Record<"light" | "dark", { background: string; foreground: string }>;
  brand: string;
  web: string;
  unavailable: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const layersId = useId();
  const resolved = modeValues
    ? [
        { mode: "Light", value: modeValues.light },
        { mode: "Dark", value: modeValues.dark },
      ]
    : [{ mode: "", value }];
  const entries = resolved.map((entry) => ({
    ...entry,
    layers: row.type === "shadow" && entry.value ? shadowLayers(entry.value) : [],
  }));
  const hasLayers = entries.some((entry) => entry.layers.length > 1);
  const tokenRow = (
    <tr
      className="docs-token-row"
      data-token={row.name}
      data-mode-comparison={modeValues ? "" : undefined}
      data-layers-expanded={hasLayers && expanded ? "" : undefined}
    >
      {modeValues ? (
        (["light", "dark"] as const).map((mode) => (
          <td
            key={mode}
            className="docs-token-preview"
            data-foundation="default"
            data-brand={brand}
            data-theme={mode}
            data-web={web}
            data-semantic-web="default"
            data-semantic-fumadocs="default"
            data-semantic-storefront="default"
            style={{
              backgroundColor: modePaint[mode].background || undefined,
              color: modePaint[mode].foreground || undefined,
            }}
          >
            {unavailable || modeValues[mode] === "" ? (
              <span className="docs-token-na">Not available</span>
            ) : (
              <Preview row={row} resolvedValue={modeValues[mode]} />
            )}
            {!isNonvisual(row) ? (
              <span className="docs-token-mode-name">{mode === "light" ? "Light" : "Dark"}</span>
            ) : null}
          </td>
        ))
      ) : (
        <td className="docs-token-preview">
          {unavailable || value === "" ? (
            <span className="docs-token-na">Not available</span>
          ) : (
            <Preview row={row} />
          )}
        </td>
      )}
      <td className="docs-token-token">
        <span className="docs-token-name">
          <code>{row.name}</code>
          <CopyToken name={row.name} />
        </span>
        {semantic && row.aliases.length ? (
          <span className="docs-token-alias">
            <span>Alias</span> <code>{row.aliases.join(", ")}</code>
          </span>
        ) : null}
      </td>
      <td className="docs-token-value">
        <span className="docs-token-mode-values">
          {entries.map((entry) => (
            <span key={entry.mode}>
              {entry.mode ? <span className="docs-token-value-mode">{entry.mode}</span> : null}
              {entry.layers.length > 1 ? (
                <span>{entry.layers.length} layers</span>
              ) : (
                <Value value={entry.value} />
              )}
            </span>
          ))}
        </span>
        {hasLayers ? (
          <button
            type="button"
            className="docs-token-layers-toggle"
            aria-expanded={expanded}
            aria-controls={layersId}
            onClick={() => setExpanded((previous) => !previous)}
          >
            {expanded ? "Hide" : "Show"} resolved layers
          </button>
        ) : null}
      </td>
      <td className="docs-token-use">{row.description}</td>
    </tr>
  );
  return (
    <>
      {tokenRow}
      {hasLayers ? (
        <tr id={layersId} className="docs-token-layers-row" hidden={!expanded}>
          <td className="docs-token-layers" colSpan={modeValues ? 5 : 4}>
            {entries.map((entry) => (
              <section key={entry.mode}>
                {entry.mode ? <strong>{entry.mode}</strong> : null}
                {entry.layers.length ? (
                  <ol>
                    {entry.layers.map((layer, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: Ordered shadow layers can repeat identical values.
                      <li key={`${index}-${layer}`}>
                        <code>{layer}</code>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <Value value={entry.value} />
                )}
              </section>
            ))}
          </td>
        </tr>
      ) : null}
    </>
  );
}

export interface TokenPreviewEnvironment {
  theme: string;
  web: string;
  brandIndex?: number;
}

export function TokenTable({
  category,
  data,
  compareModes = false,
  children,
  environment: controlledEnvironment,
}: {
  category: string;
  data: Omit<
    Extract<TokenReferenceData, { available: true }>,
    "brandStylesheets" | "componentStylesheets" | "bridges"
  >;
  compareModes?: boolean;
  children?: ReactNode;
  environment?: TokenPreviewEnvironment;
}) {
  const { Choice } = useExampleComponents();
  const [brandIndex, setBrandIndex] = useState(0);
  const [documentEnvironment, setEnvironment] = useState({ theme: "light", web: "lg" });
  const environment = controlledEnvironment ?? documentEnvironment;
  const [values, setValues] = useState<{
    active: Record<string, string>;
    light: Record<string, string>;
    dark: Record<string, string>;
  }>({ active: {}, light: {}, dark: {} });
  const [modePaint, setModePaint] = useState({
    light: { background: "", foreground: "" },
    dark: { background: "", foreground: "" },
  });
  const scope = useRef<HTMLDivElement>(null);
  const lightScope = useRef<HTMLDivElement>(null);
  const darkScope = useRef<HTMLDivElement>(null);
  const brand = data.brands[controlledEnvironment?.brandIndex ?? brandIndex] ?? data.brands[0];

  useEffect(() => {
    if (controlledEnvironment) return;
    const root = document.documentElement;
    const update = () =>
      setEnvironment({
        theme: root.dataset.theme ?? (root.classList.contains("dark") ? "dark" : "light"),
        web: root.dataset.web ?? "lg",
      });
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "data-web", "class"],
    });
    return () => observer.disconnect();
  }, [controlledEnvironment]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reread computed CSS after the document theme or breakpoint changes.
  useEffect(() => {
    if (!scope.current || !brand.cssAvailable) return;
    const rows = brand.groups.flatMap((group) => group.rows);
    const resolve = (element: HTMLElement) => {
      const next = readValues(element, rows);
      return Object.fromEntries(rows.map((row) => [row.name, next[row.name] ?? ""]));
    };
    if (compareModes && lightScope.current && darkScope.current) {
      setValues({
        active: {},
        light: resolve(lightScope.current),
        dark: resolve(darkScope.current),
      });
      const paint = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return {
          background: style.getPropertyValue("--color-surface-body").trim(),
          foreground: style.getPropertyValue("--color-on-surface").trim(),
        };
      };
      setModePaint({ light: paint(lightScope.current), dark: paint(darkScope.current) });
    } else {
      setValues({ active: resolve(scope.current), light: {}, dark: {} });
    }
  }, [brand, compareModes, environment.theme, environment.web]);

  return (
    <div
      ref={scope}
      data-focus-island
      data-foundation="default"
      data-brand={brand.cssBrand}
      data-theme={environment.theme}
      data-web={environment.web}
      data-semantic-web="default"
      data-semantic-fumadocs="default"
      data-semantic-storefront="default"
      className="docs-token-reference not-prose"
    >
      {data.brands.length > 1 && controlledEnvironment?.brandIndex === undefined ? (
        <div className="docs-token-brand">
          <Choice
            label="Brand"
            value={String(brandIndex)}
            onChange={(value) => setBrandIndex(Number(value))}
            options={data.brands.map((option, index) => ({
              value: String(index),
              label: option.label,
            }))}
          />
        </div>
      ) : null}
      {brand.cssAvailable ? children : null}
      {compareModes
        ? (["light", "dark"] as const).map((mode) => (
            <div key={mode} aria-hidden="true" className="docs-token-probes" data-theme={mode}>
              <div
                ref={mode === "light" ? lightScope : darkScope}
                data-focus-island
                data-token-preview-theme={mode}
                data-foundation="default"
                data-brand={brand.cssBrand}
                data-theme={mode}
                data-web={environment.web}
                data-semantic-web="default"
                data-semantic-fumadocs="default"
                data-semantic-storefront="default"
              />
            </div>
          ))
        : null}
      <div className="docs-token-scroll">
        {brand.groups.map((group) => (
          <section key={group.label} aria-labelledby={tokenGroupId(category, group.label)}>
            <h2 id={tokenGroupId(category, group.label)}>{group.label}</h2>
            <table aria-label={group.label}>
              <thead>
                <tr>
                  {compareModes ? (
                    <>
                      <th scope="col">Light</th>
                      <th scope="col">Dark</th>
                    </>
                  ) : (
                    <th scope="col">Preview</th>
                  )}
                  <th scope="col">Token</th>
                  <th scope="col">Value</th>
                  <th scope="col">Use</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <TokenRow
                    key={row.name}
                    row={row}
                    semantic={group.semantic}
                    value={brand.cssAvailable && group.cssAvailable ? values.active[row.name] : ""}
                    modeValues={
                      compareModes
                        ? {
                            light:
                              brand.cssAvailable && group.cssAvailable
                                ? values.light[row.name]
                                : "",
                            dark:
                              brand.cssAvailable && group.cssAvailable ? values.dark[row.name] : "",
                          }
                        : undefined
                    }
                    modePaint={modePaint}
                    brand={brand.cssBrand}
                    web={environment.web}
                    unavailable={!brand.cssAvailable || !group.cssAvailable}
                  />
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      {!brand.groups.length ? (
        <p>No tokens in this category are present in the selected sets.</p>
      ) : null}
    </div>
  );
}
