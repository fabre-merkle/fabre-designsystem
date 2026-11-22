"use client";
import { createContext, type ReactNode, use } from "react";

const DemoArgsContext = createContext<readonly string[]>([]);

/**
 * The names of a story's demo-only arguments: settings that shape the example and are not props of
 * the component. The controls draw them in their own "Demo" group.
 */
export function DemoArgsProvider({
  names,
  children,
}: {
  names: readonly string[];
  children: ReactNode;
}) {
  return <DemoArgsContext value={names}>{children}</DemoArgsContext>;
}

export function useDemoArgs(): readonly string[] {
  return use(DemoArgsContext);
}
