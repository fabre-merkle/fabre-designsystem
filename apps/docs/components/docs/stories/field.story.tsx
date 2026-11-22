import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { FieldDemo, type FieldDemoProps } from "./field-demo";

export const title = "Field";
// The controls are generated from `FieldDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Field props: drawn in the "Demo" group. */
export const demoArgs = ["label", "showDescription", "required"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  disabled: false,
  invalid: false,
  validationMode: "onSubmit",
  label: "Work email",
  showDescription: true,
  required: false,
} satisfies FieldDemoProps;

export const presets: DocsStoryPreset<FieldDemoProps>[] = [
  {
    variant: "Default",
    description: "A label, a control and helper text. Clicking the label moves to the control.",
    initial: base,
  },
  {
    variant: "Without description",
    description: "The description is optional. Leave it out when the label says enough.",
    initial: { ...base, showDescription: false },
  },
  {
    variant: "Invalid",
    description:
      "invalid forces the error state. Field.Error with match shows the message and ties it to the control.",
    initial: { ...base, invalid: true },
  },
  {
    variant: "Validate on blur",
    description:
      "Required, and checked when the control loses focus. Tab into it and out again to see the error.",
    initial: { ...base, required: true, validationMode: "onBlur" },
  },
  {
    variant: "Disabled",
    description: "The control and its label are inert.",
    initial: { ...base, disabled: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: FieldDemoProps): string {
  const {
    disabled,
    invalid,
    validationMode,
    label = "Work email",
    showDescription,
    required,
  } = props;
  const root = jsxSnippet(
    "Field.Root",
    { name: "email", disabled, invalid, validationMode },
    { openOnly: true, defaults: { validationMode: "onSubmit" } },
  );
  const input = jsxSnippet("Input", { type: "email", required });
  return [
    root,
    `  <Field.Label>${label}</Field.Label>`,
    `  <Field.Control render={${input}} />`,
    ...(showDescription
      ? ["  <Field.Description>We only use this to send the invite.</Field.Description>"]
      : []),
    ...(invalid
      ? ["  <Field.Error match>That address is already registered.</Field.Error>"]
      : [
          '  <Field.Error match="valueMissing">An email is required.</Field.Error>',
          '  <Field.Error match="typeMismatch">Enter a valid email address.</Field.Error>',
        ]),
    "</Field.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Field",
  Component: FieldDemo,
  args: presets,
});
