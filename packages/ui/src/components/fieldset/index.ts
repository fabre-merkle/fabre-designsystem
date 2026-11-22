// The namespace object is assembled HERE, in a module with no "use client"
// directive (the parts live in the "use client" fieldset.tsx), so a React
// Server Component importing `Fieldset` receives a real object whose `.Root`
// (etc.) are renderable client references. Mirrors Base UI's own index.parts.
import { Legend, Root } from "./fieldset";

export const Fieldset = { Root, Legend };
