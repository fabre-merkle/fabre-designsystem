import path from "node:path";

/**
 * Maps each @workspace/ui component slug to the on-disk source files the docs
 * ComponentShowcase source tabs read.
 *
 * `process.cwd()` is `apps/docs/` when Next runs, so going up two levels
 * lands at the repo root, then into `packages/ui/src/components/`.
 *
 * The components, plus `elevated`, `surface-provider` and `web-grid` (the utility pages).
 */
const ROOT = path.join(process.cwd(), "..", "..", "packages/ui/src/components");

export type ComponentFile = {
  name: string;
  path: string;
  lang: "tsx" | "css";
};

export type ComponentEntry = {
  files: ComponentFile[];
};

function entry(slug: string): ComponentEntry {
  return {
    files: [
      {
        name: `${slug}.tsx`,
        path: path.join(ROOT, slug, `${slug}.tsx`),
        lang: "tsx",
      },
      {
        name: `${slug}.css`,
        path: path.join(ROOT, slug, `${slug}.css`),
        lang: "css",
      },
    ],
  };
}

export const componentRegistry: Record<string, ComponentEntry> = {
  accordion: entry("accordion"),
  alert: entry("alert"),
  "alert-dialog": entry("alert-dialog"),
  autocomplete: entry("autocomplete"),
  avatar: entry("avatar"),
  badge: entry("badge"),
  button: entry("button"),
  card: {
    files: [
      ...entry("card").files,
      { name: "index.ts", path: path.join(ROOT, "card", "index.ts"), lang: "tsx" },
    ],
  },
  checkbox: entry("checkbox"),
  "checkbox-group": entry("checkbox-group"),
  collapsible: entry("collapsible"),
  combobox: entry("combobox"),
  "context-menu": entry("context-menu"),
  controls: {
    files: [{ name: "control.css", path: path.join(ROOT, "control", "control.css"), lang: "css" }],
  },
  dialog: entry("dialog"),
  drawer: entry("drawer"),
  elevated: {
    files: [
      ...entry("elevated").files,
      {
        name: "surface-level.tsx",
        path: path.join(ROOT, "elevated", "surface-level.tsx"),
        lang: "tsx",
      },
    ],
  },
  field: entry("field"),
  fieldset: entry("fieldset"),
  form: entry("form"),
  input: entry("input"),
  menu: entry("menu"),
  menubar: entry("menubar"),
  meter: entry("meter"),
  "navigation-menu": entry("navigation-menu"),
  "number-field": entry("number-field"),
  "otp-field": entry("otp-field"),
  popover: entry("popover"),
  "preview-card": entry("preview-card"),
  progress: entry("progress"),
  radio: entry("radio"),
  "radio-group": entry("radio-group"),
  "scroll-area": entry("scroll-area"),
  select: entry("select"),
  separator: entry("separator"),
  slider: entry("slider"),
  spinner: entry("spinner"),
  "surface-provider": entry("surface-provider"),
  switch: entry("switch"),
  tabs: entry("tabs"),
  toast: entry("toast"),
  toggle: entry("toggle"),
  "toggle-group": entry("toggle-group"),
  toolbar: entry("toolbar"),
  tooltip: entry("tooltip"),
  "web-grid": {
    files: [
      ...entry("web-grid").files,
      { name: "index.ts", path: path.join(ROOT, "web-grid", "index.ts"), lang: "tsx" },
    ],
  },
};
