import type { FC } from "react";
// Rollout batch 4 (display and disclosure).
import * as accordion from "../components/docs/stories/accordion.story";
import * as alert from "../components/docs/stories/alert.story";
import * as alertDialog from "../components/docs/stories/alert-dialog.story";
// Rollout batch 2 (fields, pickers and menus).
import * as autocomplete from "../components/docs/stories/autocomplete.story";
import * as avatar from "../components/docs/stories/avatar.story";
// Wave 2 batch B (forms and display).
import * as badge from "../components/docs/stories/badge.story";
import * as button from "../components/docs/stories/button.story";
// Card, composed on Elevated.
import * as card from "../components/docs/stories/card.story";
import * as checkbox from "../components/docs/stories/checkbox.story";
import * as checkboxGroup from "../components/docs/stories/checkbox-group.story";
import * as collapsible from "../components/docs/stories/collapsible.story";
import * as combobox from "../components/docs/stories/combobox.story";
import * as contextMenu from "../components/docs/stories/context-menu.story";
import * as controls from "../components/docs/stories/controls.story";
import * as dialog from "../components/docs/stories/dialog.story";
import * as drawer from "../components/docs/stories/drawer.story";
import * as elevated from "../components/docs/stories/elevated.story";
import * as field from "../components/docs/stories/field.story";
import * as fieldset from "../components/docs/stories/fieldset.story";
import * as form from "../components/docs/stories/form.story";
import * as input from "../components/docs/stories/input.story";
import * as menu from "../components/docs/stories/menu.story";
import * as menubar from "../components/docs/stories/menubar.story";
import * as meter from "../components/docs/stories/meter.story";
import * as navigationMenu from "../components/docs/stories/navigation-menu.story";
import * as numberField from "../components/docs/stories/number-field.story";
import * as otpField from "../components/docs/stories/otp-field.story";
import * as popover from "../components/docs/stories/popover.story";
import * as previewCard from "../components/docs/stories/preview-card.story";
import * as progress from "../components/docs/stories/progress.story";
import * as radio from "../components/docs/stories/radio.story";
import * as radioGroup from "../components/docs/stories/radio-group.story";
import * as scrollArea from "../components/docs/stories/scroll-area.story";
import * as select from "../components/docs/stories/select.story";
import * as separator from "../components/docs/stories/separator.story";
import * as slider from "../components/docs/stories/slider.story";
import * as spinner from "../components/docs/stories/spinner.story";
import * as switchStory from "../components/docs/stories/switch.story";
import * as tabs from "../components/docs/stories/tabs.story";
import * as toast from "../components/docs/stories/toast.story";
import * as toggle from "../components/docs/stories/toggle.story";
import * as toggleGroup from "../components/docs/stories/toggle-group.story";
import * as toolbar from "../components/docs/stories/toolbar.story";
import * as tooltip from "../components/docs/stories/tooltip.story";
import * as webGrid from "../components/docs/stories/web-grid.story";
import type { DocsStoryModule } from "./docs-story-types";

type DocsStoryFile = DocsStoryModule<any> & { story: { WithControl: FC } };

/**
 * The docs stories, by the `name` an MDX page passes to `<DocsStory name="…" />`. A new
 * `*.story.tsx` file is added here.
 */
export const docsStories: Record<string, DocsStoryFile> = {
  button,
  checkbox,
  dialog,
  input,
  "number-field": numberField,
  "otp-field": otpField,
  "radio-group": radioGroup,
  slider,
  switch: switchStory,
  toggle,
  tabs,
  "toggle-group": toggleGroup,
  // Rollout batch 2 (fields, pickers and menus).
  autocomplete,
  combobox,
  menu,
  select,
  // Rollout batch 4 (display and disclosure).
  accordion,
  alert,
  avatar,
  meter,
  progress,
  separator,
  spinner,
  // Wave 2 batch A (overlays and menus).
  "alert-dialog": alertDialog,
  drawer,
  popover,
  "preview-card": previewCard,
  toast,
  tooltip,
  "context-menu": contextMenu,
  menubar,
  "navigation-menu": navigationMenu,
  // Wave 2 batch B (forms and display).
  badge,
  "checkbox-group": checkboxGroup,
  collapsible,
  field,
  fieldset,
  form,
  radio,
  "scroll-area": scrollArea,
  toolbar,
  // Card, composed on Elevated.
  card,
  elevated,
  // Utilities.
  controls,
  "web-grid": webGrid,
};

export function getDocsStory(name: string): DocsStoryFile {
  const entry = docsStories[name];
  if (!entry) throw new Error(`Unknown docs story: ${name}`);
  return entry;
}
