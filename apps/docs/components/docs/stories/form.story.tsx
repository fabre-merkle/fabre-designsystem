import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { FormDemo, type FormDemoProps } from "./form-demo";

export const title = "Form";
// The controls are generated from `FormDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Form props: drawn in the "Demo" group. */
export const demoArgs = ["serverError"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  validationMode: "onSubmit",
  serverError: false,
} satisfies FormDemoProps;

export const presets: DocsStoryPreset<FormDemoProps>[] = [
  {
    variant: "Validate on submit",
    description: "The default. Submit with the field empty to see the error.",
    initial: base,
  },
  {
    variant: "Validate on blur",
    description: "Each field is checked when focus leaves it.",
    initial: { ...base, validationMode: "onBlur" },
  },
  {
    variant: "Validate on change",
    description: "Each field is checked on every keystroke.",
    initial: { ...base, validationMode: "onChange" },
  },
  {
    variant: "Server error",
    description:
      "Enter a valid email and submit. The errors prop shows a server-side error, which clears when the field changes.",
    initial: { ...base, serverError: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet({ validationMode, serverError }: FormDemoProps): string {
  const open = jsxSnippet(
    "Form",
    {
      validationMode,
      errors: serverError ? raw("serverErrors") : undefined,
      onSubmit: raw("handleSubmit"),
    },
    { openOnly: true, defaults: { validationMode: "onSubmit" } },
  );
  return [
    open,
    '  <Field.Root name="email">',
    "    <Field.Label>Work email</Field.Label>",
    '    <Field.Control render={<Input type="email" required />} />',
    '    <Field.Error match="valueMissing">An email is required.</Field.Error>',
    ...(serverError ? ["    <Field.Error />"] : []),
    "  </Field.Root>",
    '  <Button type="submit" variant="primary">Send invite</Button>',
    "</Form>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Form",
  Component: FormDemo,
  args: presets,
});
