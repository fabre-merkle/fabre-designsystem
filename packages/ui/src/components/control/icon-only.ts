import React from "react";

/** A direct child that declares itself an icon (`data-icon`), or is an svg element. */
export function isIconChild(node: React.ReactNode): boolean {
  if (!React.isValidElement(node)) return false;
  const props = node.props as Record<string, unknown>;
  return node.type === "svg" || props["data-icon"] !== undefined;
}

/**
 * Whether the children contain readable text. Icon children (svg or `data-icon`)
 * and `aria-hidden` subtrees do not count; visually hidden text does.
 */
export function hasTextContent(node: React.ReactNode): boolean {
  if (typeof node === "string") return node.trim() !== "";
  if (typeof node === "number") return true;
  if (Array.isArray(node)) return node.some(hasTextContent);
  if (!React.isValidElement(node) || isIconChild(node)) return false;
  const props = node.props as { children?: React.ReactNode; "aria-hidden"?: unknown };
  if (props["aria-hidden"] === true || props["aria-hidden"] === "true") return false;
  return hasTextContent(props.children);
}

/** Whether `aria-label` or `aria-labelledby` holds a non-blank string. */
export function hasAriaName(props: object): boolean {
  const { "aria-label": label, "aria-labelledby": labelledBy } = props as Record<string, unknown>;
  return [label, labelledBy].some((value) => typeof value === "string" && value.trim() !== "");
}

/**
 * Whether readable text comes before the first element child, as in `Save<Icon />`. CSS sees
 * elements but not text nodes, so it needs this to tell `<Icon />Save` (a start icon) from
 * `Save<Icon />` (an end icon) when the icon has no `data-icon`.
 */
export function hasLeadingText(children: React.ReactNode): boolean {
  for (const node of React.Children.toArray(children)) {
    if (React.isValidElement(node)) {
      // A fragment is transparent: its children sit in the same flow.
      if (node.type === React.Fragment) {
        const inner = (node.props as { children?: React.ReactNode }).children;
        if (hasLeadingText(inner)) return true;
        if (React.Children.toArray(inner).length > 0) return false;
        continue;
      }
      return false;
    }
    if (typeof node === "number" || (typeof node === "string" && node.trim() !== "")) return true;
  }
  return false;
}

/**
 * Marks each direct icon child with the control's icon part (`data-ui="button-icon"`), which the
 * CSS and the Figma contract size, without wrapping it: the child stays the element the caller
 * passed. A child that already has a `data-ui` keeps it.
 */
export function markIconChildren(
  children: React.ReactNode,
  mark: { "data-ui": string },
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (!isIconChild(child) || !React.isValidElement(child)) return child;
    if ((child.props as Record<string, unknown>)["data-ui"] !== undefined) return child;
    return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, mark);
  });
}

export type IconSide = "start" | "end" | "both";

/**
 * Which side of a control's label an icon child sits on, for the padding the icon side gives back.
 * An icon that names its side (`data-icon="inline-start"` or `"inline-end"`) wins. Otherwise the
 * side is inferred the way the stylesheet's fallback does: with text present, an icon first among
 * the element children and with no text before it is a start icon, and the last icon (with text
 * before it, or after another element) is an end icon. Undefined when there is no such icon, or
 * when a fragment hides the order, which the stylesheet's `:has()` fallback still handles.
 */
export function iconSideOf(children: React.ReactNode): IconSide | undefined {
  const elements = React.Children.toArray(children).filter(React.isValidElement);
  let start = false;
  let end = false;
  const hasText = hasTextContent(children);
  const leadingText = hasLeadingText(children);
  const ordered = !elements.some((element) => element.type === React.Fragment);
  elements.forEach((element, index) => {
    if (!isIconChild(element)) return;
    const named = (element.props as Record<string, unknown>)["data-icon"];
    if (named === "inline-start") start = true;
    else if (named === "inline-end") end = true;
    else if (ordered && hasText) {
      const first = index === 0;
      const last = index === elements.length - 1;
      if (first && !leadingText) start = true;
      else if (last && (leadingText || !first)) end = true;
    }
  });
  if (start && end) return "both";
  return start ? "start" : end ? "end" : undefined;
}
