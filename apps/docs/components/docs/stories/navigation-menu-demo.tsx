"use client";
import {
  NavigationMenuContent,
  NavigationMenuIcon,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuPopup,
  NavigationMenuPortal,
  NavigationMenuPositioner,
  NavigationMenuRoot,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from "../navigation-menu-parts";

/** Props of the demo: the NavigationMenu props it exposes. */
export type NavigationMenuDemoProps = {
  /** Milliseconds the pointer rests on a trigger before its panel opens. */
  delay?: number;
  /** Milliseconds before the panel closes after the pointer leaves. */
  closeDelay?: number;
};

const SECTIONS = [
  {
    label: "Products",
    links: [
      { href: "#analytics", title: "Analytics", hint: "Real-time dashboards and reporting" },
      {
        href: "#engagement",
        title: "Engagement",
        hint: "Campaigns, journeys, and personalisation",
      },
      { href: "#data", title: "Data Platform", hint: "Unified customer profiles" },
    ],
  },
  {
    label: "Resources",
    links: [
      { href: "#docs", title: "Documentation", hint: "Guides and API reference" },
      { href: "#blog", title: "Blog", hint: "Product updates and best practice" },
    ],
  },
] as const;

/** A site navigation bar with two panels and a plain link. The panel portals into the preview island. */
export function NavigationMenuDemo({ delay = 50, closeDelay = 50 }: NavigationMenuDemoProps) {
  return (
    <div data-focus-island>
      <NavigationMenuRoot delay={delay} closeDelay={closeDelay}>
        <NavigationMenuList>
          {SECTIONS.map((section) => (
            <NavigationMenuItem key={section.label}>
              <NavigationMenuTrigger>
                {section.label}
                <NavigationMenuIcon>▾</NavigationMenuIcon>
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                {section.links.map((link) => (
                  <NavigationMenuLink key={link.href} href={link.href}>
                    <strong>{link.title}</strong>
                    <span>{link.hint}</span>
                  </NavigationMenuLink>
                ))}
              </NavigationMenuContent>
            </NavigationMenuItem>
          ))}
          <NavigationMenuItem>
            <NavigationMenuLink href="#pricing">Pricing</NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
        <NavigationMenuPortal>
          <NavigationMenuPositioner>
            <NavigationMenuPopup>
              <NavigationMenuViewport />
            </NavigationMenuPopup>
          </NavigationMenuPositioner>
        </NavigationMenuPortal>
      </NavigationMenuRoot>
    </div>
  );
}
