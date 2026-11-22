"use client";
import { ArrowUpRight, BellSimple, Check, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { SurfaceLevel } from "@workspace/ui/components/elevated";
import { Field } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Grid } from "@workspace/ui/components/web-grid";
import type { ReactNode } from "react";

/** The docs preview is painted at surface level 3, so the cards in it read that level as their substrate. */
function OnPreview({ children }: { children: ReactNode }) {
  return <SurfaceLevel level={3}>{children}</SurfaceLevel>;
}

/** Header, content with Field and Input, and a footer with Button. */
export function CardSignInExample() {
  return (
    <OnPreview>
      <Card.Root style={{ width: "100%", maxWidth: "22rem" }}>
        <Card.Header>
          <Card.Title
            // biome-ignore lint/a11y/useHeadingContent: Card.Title fills the heading with its children
            render={<h3 />}
          >
            Sign in
          </Card.Title>
          <Card.Description>Enter your work email and password.</Card.Description>
          <Card.Action>
            <Button size="sm" variant="secondary" mode="ghost">
              Sign up
            </Button>
          </Card.Action>
        </Card.Header>
        <Card.Content>
          <form
            style={{ display: "grid", gap: "var(--spacing-300)" }}
            onSubmit={(e) => e.preventDefault()}
          >
            <Field.Root name="email">
              <Field.Label>Email</Field.Label>
              <Field.Control render={<Input type="email" placeholder="you@example.com" />} />
            </Field.Root>
            <Field.Root name="password">
              <Field.Label>Password</Field.Label>
              <Field.Control render={<Input type="password" />} />
            </Field.Root>
          </form>
        </Card.Content>
        <Card.Footer>
          <Button>Sign in</Button>
          <Button variant="secondary" mode="ghost">
            Forgot password
          </Button>
        </Card.Footer>
      </Card.Root>
    </OnPreview>
  );
}

const STATS = [
  { label: "Visitors", value: "12,480" },
  { label: "Sign-ups", value: "1,204" },
  { label: "Conversion", value: "9.6%" },
  { label: "Revenue", value: "$48.2k" },
];

/** A grid of `sm` cards, the size for dense layouts. */
export function CardStatsExample() {
  return (
    <OnPreview>
      <Grid.Root variant="4up" gap="sm" style={{ width: "100%" }}>
        {STATS.map((stat) => (
          <Card.Root key={stat.label} size="sm">
            <Card.Header>
              <Card.Description>{stat.label}</Card.Description>
              <Card.Title>{stat.value}</Card.Title>
            </Card.Header>
          </Card.Root>
        ))}
      </Grid.Root>
    </OnPreview>
  );
}

const NOTIFICATIONS = [
  { title: "Your export is ready", time: "2 minutes ago" },
  { title: "Dana commented on Launch plan", time: "1 hour ago" },
  { title: "Billing details updated", time: "Yesterday" },
];

/** A list card with an action beside the title. Rows are plain content, not nested cards. */
export function CardNotificationsExample() {
  return (
    <OnPreview>
      <Card.Root style={{ width: "100%", maxWidth: "24rem" }}>
        <Card.Header>
          <Card.Title
            // biome-ignore lint/a11y/useHeadingContent: Card.Title fills the heading with its children
            render={<h3 />}
          >
            Notifications
          </Card.Title>
          <Card.Description>You have 3 unread messages.</Card.Description>
          <Card.Action>
            <Button size="sm" variant="secondary" mode="ghost">
              <Check weight="bold" />
              Mark all read
            </Button>
          </Card.Action>
        </Card.Header>
        <Card.Content>
          <ul
            style={{
              display: "grid",
              gap: "var(--spacing-300)",
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {NOTIFICATIONS.map((item) => (
              <li
                key={item.title}
                style={{ display: "flex", gap: "var(--spacing-300)", alignItems: "start" }}
              >
                <BellSimple aria-hidden="true" weight="bold" />
                <span>
                  <span style={{ display: "block" }}>{item.title}</span>
                  <span style={{ color: "var(--color-on-surface-subtle)" }}>{item.time}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card.Content>
      </Card.Root>
    </OnPreview>
  );
}

/** A card rendered as a link: only its edge colour changes on hover. */
export function CardInteractiveExample() {
  return (
    <OnPreview>
      <Card.Root
        // biome-ignore lint/a11y/useAnchorContent: Card fills the link with its children
        render={<a href="/team/invite" onClick={(e) => e.preventDefault()} />}
        style={{ width: "100%", maxWidth: "22rem", textDecoration: "none" }}
      >
        <Card.Header>
          <Card.Title>
            <EnvelopeSimple aria-hidden="true" weight="bold" /> Invite your team
          </Card.Title>
          <Card.Description>Hover to see the overlay.</Card.Description>
          <Card.Action>
            <ArrowUpRight aria-hidden="true" weight="bold" />
          </Card.Action>
        </Card.Header>
      </Card.Root>
    </OnPreview>
  );
}
