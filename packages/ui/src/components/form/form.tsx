"use client";
import "./form.css";
import { Form as FormPrimitive } from "@base-ui/react/form";
import type React from "react";

export type FormProps = React.ComponentProps<typeof FormPrimitive>;

export function Form(props: FormProps) {
  return <FormPrimitive {...props} data-ui="form" />;
}
