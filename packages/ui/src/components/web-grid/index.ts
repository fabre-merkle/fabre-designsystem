// The namespace object is assembled HERE, in a module with no "use client"
// directive (the parts live in the "use client" web-grid.tsx), so a React Server
// Component importing `Grid` receives a real object whose `.Root` and `.Item`
// are renderable client references.
import { Item, Root } from "./web-grid";

export type {
  GridGap,
  GridItemProps,
  GridItemSpan,
  GridProps,
  GridVariant,
} from "./web-grid";

export const Grid = {
  Root,
  Item,
};
