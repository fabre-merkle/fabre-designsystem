import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { OTPFieldDemo, type OTPFieldDemoProps } from "./otp-field-demo";

export const title = "OTP Field";

/** Arguments that shape the example and are not OTPField props: drawn in the "Demo" group. */
export const demoArgs = ["invalid", "separator"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  length: 6,
  disabled: false,
  mask: false,
  defaultValue: "",
  invalid: false,
  separator: true,
} satisfies OTPFieldDemoProps;

export const presets: DocsStoryPreset<OTPFieldDemoProps>[] = [
  {
    variant: "Six digits",
    description: "One input per slot. Typing moves on, and a pasted code fills every slot.",
    initial: base,
  },
  {
    variant: "Four digits",
    description: "length sets the number of slots. Render one OTPField.Input per slot.",
    initial: { ...base, length: 4, separator: false },
  },
  {
    variant: "Masked",
    description: "mask hides the characters as they are typed.",
    initial: { ...base, mask: true, defaultValue: "123456" },
  },
  {
    variant: "Completed",
    description: "Every slot is filled.",
    initial: { ...base, defaultValue: "123456" },
  },
  {
    variant: "Invalid",
    description: "Inside a Field marked invalid, the slots take the error border and outline.",
    initial: { ...base, invalid: true },
  },
  {
    variant: "Disabled",
    description: "Not interactive and not focusable.",
    initial: { ...base, disabled: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet({ invalid, separator, defaultValue, ...props }: OTPFieldDemoProps): string {
  const length = props.length ?? 6;
  const middle = Math.floor(length / 2);
  const slots: string[] = [];
  for (let index = 0; index < length; index++) {
    if (separator && index === middle) slots.push("    <OTPField.Separator />");
    slots.push("    <OTPField.Input />");
  }
  const root = jsxSnippet(
    "OTPField.Root",
    { ...props, defaultValue: defaultValue || undefined },
    { openOnly: true },
  );
  return [
    jsxSnippet("Field.Root", { invalid }, { openOnly: true }),
    "  <Field.Label>Verification code</Field.Label>",
    `  ${root}`,
    ...slots,
    "  </OTPField.Root>",
    "</Field.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "OTP Field",
  Component: OTPFieldDemo,
  args: presets,
});
