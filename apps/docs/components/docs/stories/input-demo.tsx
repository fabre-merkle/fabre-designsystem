"use client";
import { Input, type InputProps } from "@workspace/ui/components/input";

export type InputDemoProps = Pick<InputProps, "size" | "disabled" | "readOnly"> & {
  /** Placeholder text shown while the input is empty. */
  placeholder?: string;
  /** The text in the input at first. */
  defaultValue?: string;
  /** Mark the input invalid with `aria-invalid`. */
  invalid?: boolean;
};

/** One Input. It is keyed by `defaultValue` so changing the control resets the text. */
export function InputDemo({
  size,
  disabled,
  readOnly,
  placeholder = "you@example.com",
  defaultValue = "",
  invalid,
}: InputDemoProps) {
  return (
    <div data-focus-island>
      <Input
        key={defaultValue}
        aria-label="Email"
        size={size}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-invalid={invalid ? true : undefined}
      />
    </div>
  );
}
