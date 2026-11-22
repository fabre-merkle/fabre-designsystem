"use client";
import { Button } from "@workspace/ui/components/button";
import { Field } from "@workspace/ui/components/field";
import { Form, type FormProps } from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { useState } from "react";

/** Props of the demo: the Form props it exposes, then the demo-only settings (see `demoArgs`). */
export type FormDemoProps = Pick<FormProps, "validationMode"> & {
  /** On submit, return a server-side error for the field through the `errors` prop. */
  serverError?: boolean;
};

/**
 * A Form with one required email Field. Its `onSubmit` closes over state, so it lives in a client
 * file. The body is keyed by its settings, so changing a control resets the form and its state.
 */
export function FormDemo({ validationMode = "onSubmit", serverError = false }: FormDemoProps) {
  return (
    <FormDemoBody
      key={`${validationMode}-${serverError}`}
      validationMode={validationMode}
      serverError={serverError}
    />
  );
}

function FormDemoBody({ validationMode, serverError }: FormDemoProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<string | null>(null);

  return (
    <div data-focus-island>
      <div style={{ minWidth: "20rem" }}>
        <Form
          validationMode={validationMode}
          errors={errors}
          onSubmit={(event) => {
            event.preventDefault();
            const email = String(new FormData(event.currentTarget).get("email") ?? "");
            if (serverError) {
              setSubmitted(null);
              setErrors({ email: "That address is already registered." });
            } else {
              setErrors({});
              setSubmitted(email);
            }
          }}
        >
          <Field.Root name="email">
            <Field.Label>Work email</Field.Label>
            <Field.Control render={<Input type="email" placeholder="you@example.com" required />} />
            <Field.Description>We only use this to send the invite.</Field.Description>
            <Field.Error match="valueMissing">An email is required.</Field.Error>
            <Field.Error match="typeMismatch">Enter a valid email address.</Field.Error>
            {serverError ? <Field.Error /> : null}
          </Field.Root>
          <Button type="submit" variant="primary">
            Send invite
          </Button>
          {submitted ? <p>Invite sent to {submitted}</p> : null}
        </Form>
      </div>
    </div>
  );
}
