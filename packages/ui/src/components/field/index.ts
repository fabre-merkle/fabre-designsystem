// The namespace object is assembled HERE, in a module with no "use client"
// directive (the parts live in the "use client" field.tsx), so a React Server
// Component importing `Field` receives a real object whose `.Root` (etc.) are
// renderable client references. Mirrors Base UI's own index.parts.
import { Control, Description, FieldError, Label, Root, Validity } from "./field";

export const Field = {
  Root,
  Label,
  Control,
  Description,
  Error: FieldError,
  Validity,
};
