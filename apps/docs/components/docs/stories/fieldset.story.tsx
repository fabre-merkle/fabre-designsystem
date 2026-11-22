import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { FieldsetDemo, type FieldsetDemoProps } from "./fieldset-demo";

export const title = "Fieldset";
// The controls are generated from `FieldsetDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Fieldset props: drawn in the "Demo" group. */
export const demoArgs = ["legend", "invalidEmail"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  disabled: false,
  legend: "Billing contact",
  invalidEmail: false,
} satisfies FieldsetDemoProps;

export const presets: DocsStoryPreset<FieldsetDemoProps>[] = [
  {
    variant: "Default",
    description: "Related Fields grouped under a legend, which names the group for assistive tech.",
    initial: base,
  },
  {
    variant: "Disabled",
    description: "Disabling the Fieldset makes every Field inside it inert.",
    initial: { ...base, disabled: true },
  },
  {
    variant: "With an error",
    description: "A Field inside the group keeps its own validation message.",
    initial: { ...base, invalidEmail: true },
  },
  {
    variant: "Another legend",
    description: "Name the group for what its fields describe.",
    initial: { ...base, legend: "Shipping contact" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet({
  disabled,
  legend = "Billing contact",
  invalidEmail,
}: FieldsetDemoProps): string {
  return [
    jsxSnippet("Fieldset.Root", { disabled }, { openOnly: true }),
    `  <Fieldset.Legend>${legend}</Fieldset.Legend>`,
    '  <Field.Root name="name">',
    "    <Field.Label>Full name</Field.Label>",
    "    <Field.Control render={<Input />} />",
    "  </Field.Root>",
    `  ${jsxSnippet("Field.Root", { name: "email", invalid: invalidEmail }, { openOnly: true })}`,
    "    <Field.Label>Email</Field.Label>",
    '    <Field.Control render={<Input type="email" />} />',
    "    <Field.Description>Receipts are sent here.</Field.Description>",
    "    <Field.Error match>Enter a valid email address.</Field.Error>",
    "  </Field.Root>",
    "</Fieldset.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Fieldset",
  Component: FieldsetDemo,
  args: presets,
});
