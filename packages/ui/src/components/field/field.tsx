"use client";
import "./field.css";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import type React from "react";

function Root(props: React.ComponentProps<typeof FieldPrimitive.Root>) {
  return <FieldPrimitive.Root {...props} data-ui="field" />;
}

function Label(props: React.ComponentProps<typeof FieldPrimitive.Label>) {
  return <FieldPrimitive.Label {...props} data-ui="field-label" />;
}

function Control(props: React.ComponentProps<typeof FieldPrimitive.Control>) {
  return <FieldPrimitive.Control {...props} data-ui="field-control" />;
}

function Description(props: React.ComponentProps<typeof FieldPrimitive.Description>) {
  return <FieldPrimitive.Description {...props} data-ui="field-description" />;
}

// Named FieldError (not Error) to avoid shadowing the global; exposed as
// Field.Error in the namespace assembled in index.ts.
function FieldError(props: React.ComponentProps<typeof FieldPrimitive.Error>) {
  return <FieldPrimitive.Error {...props} data-ui="field-error" />;
}

// Validity is render-prop only (no DOM element of its own) — pass through.
function Validity(props: React.ComponentProps<typeof FieldPrimitive.Validity>) {
  return <FieldPrimitive.Validity {...props} />;
}

// Parts exported individually; the namespace is assembled in index.ts (a
// non-"use client" module) so `Field.Root` works from a Server Component.
export { Control, Description, FieldError, Label, Root, Validity };
