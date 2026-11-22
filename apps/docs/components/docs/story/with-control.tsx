"use client";
/*
 * Adapted from @fumadocs/story (MIT, Copyright (c) 2023 Fuma): the story panel, passed to
 * `defineStoryFactory({ WithControl })`. Icons are Phosphor, the strings are plain English, and
 * the iframe `frame` mode and fullscreen button are left out (no story here uses them).
 *
 * Changes from the original: the Variant menu has a fixed width so descriptions do not wrap into a
 * tall, thin list, and the controls draw demo-only arguments in their own group.
 */
import { StoryProvider, useStory, useStoryArgs, type WithControlProps } from "@fumadocs/story";
import { ArrowCounterClockwise, WarningCircle } from "@phosphor-icons/react";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { Component, createElement, type ErrorInfo, type ReactNode, Suspense } from "react";
import { cn } from "./cn";
import { Controls } from "./controls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export function WithControl(props: WithControlProps) {
  return (
    <StoryProvider {...props}>
      <Panel />
    </StoryProvider>
  );
}

function Panel() {
  const { presets, displayName, preset, variant, setVariant } = useStory();
  const reset = () => setVariant(variant);
  return (
    <div className="not-prose overflow-hidden rounded-xl border bg-fd-card text-fd-card-foreground">
      {(displayName || presets.length > 1) && (
        <div className="flex h-10 items-center justify-end gap-1 ps-4 pe-1.5">
          {displayName && (
            <p className="me-auto truncate text-[0.8125rem] font-medium">{displayName}</p>
          )}
          {presets.length > 1 && <VariantSelect />}
        </div>
      )}
      <div className="p-1.5 not-first:pt-0">
        <Preview onReset={reset} />
      </div>
      {preset && hasControls(preset.controls) && (
        <Controls key={variant} node={preset.controls} onReset={reset} />
      )}
    </div>
  );
}

function hasControls(node: WithControlProps["presets"][number]["controls"]) {
  const root = node.type === "intersection" ? node.intersection : node;
  return root.type !== "never" && (root.type !== "object" || root.properties.length > 0);
}

function VariantSelect() {
  const { presets, variant, setVariant } = useStory();
  return (
    <Select value={variant} onValueChange={(value) => value !== null && setVariant(value)}>
      <SelectTrigger className="h-7 w-auto max-w-64 gap-1.5 border-0 bg-transparent px-2 text-xs hover:bg-fd-accent focus:ring-0 focus-visible:ring-2">
        <span className="text-fd-muted-foreground">Variant</span>
        <SelectValue className="truncate font-medium" />
      </SelectTrigger>
      <SelectContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        {presets.map((item) => (
          <SelectItem key={item.variant} value={item.variant} className="text-xs">
            <span className="flex flex-col">
              {item.variant}
              {item.description && (
                <span className="text-fd-muted-foreground">{item.description}</span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type BoundaryProps = {
  resetKey: unknown;
  fallback: (error: unknown) => ReactNode;
  children: ReactNode;
};

/** Catches an error thrown while rendering the story, and clears it when the arguments change. */
class StoryErrorBoundary extends Component<BoundaryProps, { error: unknown; failed: boolean }> {
  state = { error: null as unknown, failed: false };

  static getDerivedStateFromError(error: unknown) {
    return { error, failed: true };
  }

  componentDidUpdate(prev: BoundaryProps) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null, failed: false });
    }
  }

  componentDidCatch(_error: unknown, _info: ErrorInfo) {}

  render() {
    return this.state.failed ? this.props.fallback(this.state.error) : this.props.children;
  }
}

function Preview({ onReset }: { onReset: () => void }) {
  const { Component: Story } = useStory();
  const args = useStoryArgs();
  return (
    // A demo that paints its own backdrop marks its root `data-story-fill`: the frame then drops its
    // padding and clips, so the demo fills the preview edge to edge.
    <div className="rounded-md border bg-fd-background px-2.25 py-4 has-[>[data-story-fill]]:overflow-hidden has-[>[data-story-fill]]:p-0">
      <StoryErrorBoundary
        resetKey={args}
        fallback={(error) => (
          <div role="alert" className="flex flex-col items-start gap-2 text-sm">
            <p className="inline-flex items-center gap-2 font-medium">
              <WarningCircle aria-hidden="true" className="size-3.5 shrink-0 text-fd-error" />
              Encountered error when rendering the component.
            </p>
            <p className="font-mono text-xs break-all text-fd-muted-foreground">
              {error instanceof Error ? error.message : String(error)}
            </p>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1.5")}
              onClick={onReset}
            >
              <ArrowCounterClockwise aria-hidden="true" className="size-3.5" />
              Reset
            </button>
          </div>
        )}
      >
        <Suspense>{createElement(Story, { ...args, key: undefined })}</Suspense>
      </StoryErrorBoundary>
    </div>
  );
}
