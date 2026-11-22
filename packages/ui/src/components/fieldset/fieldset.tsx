"use client";
import "./fieldset.css";
import { Fieldset as FieldsetPrimitive } from "@base-ui/react/fieldset";
import type React from "react";

function Root(props: React.ComponentProps<typeof FieldsetPrimitive.Root>) {
  return <FieldsetPrimitive.Root {...props} data-ui="fieldset" />;
}

function Legend(props: React.ComponentProps<typeof FieldsetPrimitive.Legend>) {
  return <FieldsetPrimitive.Legend {...props} data-ui="fieldset-legend" />;
}

// Parts exported individually; the namespace is assembled in index.ts (a
// non-"use client" module) so `Fieldset.Root` works from a Server Component.
export { Legend, Root };
