"use client";
import { getDefaultValue, type TypeNode } from "@fumadocs/story/type-tree";
/*
 * Adapted from @fumadocs/story (MIT, Copyright (c) 2023 Fuma): the story controls panel.
 * Icons are Phosphor and the strings are plain English instead of translation keys.
 *
 * Change from the original: arguments the story lists as demo-only (its `demoArgs` export, passed
 * down by `DocsStory` through `DemoArgsProvider`) are drawn in their own "Demo" group under the
 * real props. The breadcrumb's sibling select for nested objects is left out; a story's
 * arguments here are flat.
 */
import { useDataEngine } from "@fumari/stf";
import { stringifyFieldKey } from "@fumari/stf/lib/utils";
import { ArrowCounterClockwise, ArrowLeft, CaretRight } from "@phosphor-icons/react";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { useState } from "react";
import { cn } from "./cn";
import { useDemoArgs } from "./demo-args";
import { type FieldEntry, FieldRows, getNestedFields, resolveNode } from "./fields";

const motionClassNames = {
  forward: "motion-safe:starting:translate-x-6",
  back: "motion-safe:starting:-translate-x-6",
  next: "motion-safe:starting:translate-y-4",
  previous: "motion-safe:starting:-translate-y-4",
};
type Motion = keyof typeof motionClassNames;
const easing = "motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]";
const transitionClassName = cn("motion-safe:transition-[opacity,translate]", easing);
const crumbClassName =
  "truncate rounded-md px-1.5 py-1 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring";

/** Split the controls node into the real props and the story's demo-only arguments. */
function splitDemo(node: TypeNode, names: readonly string[]): { real: TypeNode; demo?: TypeNode } {
  const root = node.type === "intersection" ? node.intersection : node;
  if (root.type !== "object" || names.length === 0) return { real: node };
  const demo = root.properties.filter((p) => names.includes(p.name));
  if (demo.length === 0) return { real: node };
  return {
    real: { ...root, properties: root.properties.filter((p) => !names.includes(p.name)) },
    demo: { ...root, properties: demo },
  };
}

/** the arguments of a story, nested fields open in a panel over them */
export function Controls({ node, onReset }: { node: TypeNode; onReset: () => void }) {
  const engine = useDataEngine() as any;
  const [stack, setStack] = useState<FieldEntry[]>([]);
  const [motion, setMotion] = useState<Motion>("forward");
  const current = stack.at(-1);
  const { real, demo } = splitDemo(node, useDemoArgs());

  function navigate(next: FieldEntry[], nextMotion?: Motion) {
    const target = next.at(-1);
    if (target) {
      engine.init(target.fieldName, () => getDefaultValue(resolveNode(target.node, undefined)));
    }
    setMotion(nextMotion ?? (next.length >= stack.length ? "forward" : "back"));
    setStack(next);
  }

  function openNested(parents: FieldEntry[]) {
    return (entry: FieldEntry, siblings: FieldEntry[]) =>
      navigate([...parents, { ...entry, siblings: getNestedFields(engine, siblings) }]);
  }

  return (
    <div className="@container flex flex-col leading-normal">
      <Breadcrumbs stack={stack} onNavigate={navigate} onReset={onReset} />
      <div className="flex max-h-[600px] flex-col">
        <div
          className={cn(
            "fd-scroll-container min-h-0 overflow-y-auto",
            transitionClassName,
            current && "invisible h-0 opacity-0 motion-safe:-translate-x-6",
          )}
        >
          <FieldRows
            entry={{ fieldName: [], name: "Props", node: real }}
            onNavigate={openNested([])}
          />
          {demo && (
            <section aria-labelledby="story-demo-heading">
              <h3
                id="story-demo-heading"
                className="border-y bg-fd-secondary/50 px-4 py-2 text-xs font-medium text-fd-muted-foreground"
              >
                Demo
                <span className="ms-2 font-normal">Shapes this example. Not component props.</span>
              </h3>
              <FieldRows
                entry={{ fieldName: [], name: "Demo", node: demo }}
                onNavigate={openNested([])}
              />
            </section>
          )}
        </div>
        {current && (
          <div
            key={stringifyFieldKey(current.fieldName)}
            className={cn(
              "fd-scroll-container min-h-0 overflow-y-auto starting:opacity-0",
              transitionClassName,
              motionClassNames[motion],
            )}
          >
            <FieldRows entry={current} onNavigate={openNested(stack)} />
          </div>
        )}
      </div>
    </div>
  );
}

/** the title of arguments, it becomes the path to a nested field */
function Breadcrumbs({
  stack,
  onNavigate,
  onReset,
}: {
  stack: FieldEntry[];
  onNavigate: (next: FieldEntry[], motion?: Motion) => void;
  onReset: () => void;
}) {
  const engine = useDataEngine() as any;
  const current = stack.at(-1);
  let end: React.ReactNode;
  if (!current) {
    end = (
      <button
        type="button"
        aria-label="Reset"
        title="Reset"
        onClick={onReset}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "ms-auto text-fd-muted-foreground [&_svg]:size-3.5",
        )}
      >
        <ArrowCounterClockwise aria-hidden="true" />
      </button>
    );
  } else if (current.removal) {
    end = (
      <button
        type="button"
        onClick={() => {
          engine.delete(current.fieldName);
          onNavigate(stack.slice(0, -1));
        }}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "ms-auto shrink-0 text-fd-muted-foreground",
        )}
      >
        {current.removal === "remove" ? "Remove" : "Unset"}
      </button>
    );
  }
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex h-10 shrink-0 items-center gap-1 border-b ps-4 pe-1.5 text-[0.8125rem]"
    >
      <button
        type="button"
        aria-label="Back"
        onClick={() => onNavigate(stack.slice(0, -1))}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "size-6 shrink-0 p-0 text-fd-muted-foreground motion-safe:transition-[background-color,color,margin,opacity,visibility] [&_svg]:size-3.5",
          easing,
          current ? "-ms-1.25" : "invisible -ms-8.5 opacity-0",
        )}
      >
        <ArrowLeft aria-hidden="true" />
      </button>
      <ol className="flex min-w-0 items-center gap-0.5">
        <li className="flex shrink-0 items-center">
          {current ? (
            <button type="button" onClick={() => onNavigate([])} className={crumbClassName}>
              Props
            </button>
          ) : (
            <span aria-current="page" className="px-1.5 py-1 text-fd-muted-foreground">
              Props
            </span>
          )}
        </li>
        {stack.map((entry, i) => {
          const item =
            i < stack.length - 1 ? (
              <button
                type="button"
                onClick={() => onNavigate(stack.slice(0, i + 1))}
                className={cn(crumbClassName, "font-mono")}
              >
                {entry.name}
              </button>
            ) : (
              <span aria-current="page" className="truncate px-1.5 py-1 font-mono font-medium">
                {entry.name}
              </span>
            );
          return (
            <li
              key={stringifyFieldKey(entry.fieldName)}
              className="flex min-w-0 items-center gap-0.5 last:shrink-0 motion-safe:transition-opacity motion-safe:starting:opacity-0"
            >
              <CaretRight
                aria-hidden="true"
                className="size-3.5 shrink-0 text-fd-muted-foreground/60"
              />
              {item}
            </li>
          );
        })}
      </ol>
      {end}
    </nav>
  );
}
