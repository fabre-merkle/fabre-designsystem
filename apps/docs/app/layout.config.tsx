import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/**
 * Shared layout config consumed by both `app/(home)/layout.tsx` and
 * `app/docs/layout.tsx`. Keeps nav/footer/branding in one place so
 * content pages don't need to repeat the configuration.
 *
 * TODO(@focus/docs-foundations): once the foundations + guideline docs
 * items land, populate `links` with the actual top-nav structure
 * (Foundations, Components, Guidelines, Scaffolder, Token Generator).
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    // Placeholder title — rename to your design system / product name.
    title: <span className="font-semibold tracking-tight">Documentation</span>,
  },
};
