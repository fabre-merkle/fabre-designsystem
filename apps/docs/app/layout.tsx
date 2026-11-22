import "./globals.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
// Installed from the registry (`ui-surface-provider`, a registryDependency of this item). The
// scaffolder maps the `@ui` alias to apps/docs/components/ui for this install, so it lands at
// apps/docs/components/ui/surface-provider in both the default and docs-only profiles (no UI
// workspace package needed). Relative on purpose: shadcn rewrites `@/components/ui/*` imports in
// installed files to the root alias value (a workspace-root path), which the docs app can't resolve.
import { SurfaceProvider } from "../components/ui/surface-provider";

export const metadata: Metadata = {
  title: "Docs",
  description: "Design system documentation. Tokens, components, registry.",
};

// Pre-paint breakpoint detection: sets html[data-web] from the viewport before
// first paint so the web/*.css token layer (scoped [data-web]) resolves
// correctly with no flash. Breakpoints (767 / 1023) mirror
// --brand-breakpoint-{sm,md}-max in brand/fabre-designsystem.css — keep in sync. data-web="lg"
// stays as the SSR default for no-JS; this corrects it client-side. Live resize
// handling is <SurfaceProvider /> (mounted in <body>).
const surfaceInitScript = `(function(){var w=window.innerWidth;document.documentElement.dataset.web=w<=767?'sm':w<=1023?'md':'lg'})()`;

/**
 * Root layout for the docs site.
 *
 * The `data-foundation` / `data-brand` / `data-semantic-fumadocs` attributes
 * power the dimensional token cascade: tokens are scoped under these
 * attribute selectors in the CSS bridge so multi-brand / multi-theme works
 * by attribute switching, not by hardcoded themes. See plan v4.1 Addendum
 * "design-tokens.mdx" for the full rationale.
 *
 * The raw inline `surfaceInitScript` in <head> sets `data-web` from the
 * viewport before first paint; `<SurfaceProvider />` keeps it in sync on resize.
 * It is a plain <script> (not next/script) so it runs synchronously during HTML
 * parse with no React "script tag" warning, and the no-flash value is correct
 * on first paint.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-foundation="default"
      data-brand="fabre-designsystem"
      data-semantic-web="default"
      data-semantic-fumadocs="default"
      data-web="lg"
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, build-time-constant inline script (no user input) for pre-paint data-web breakpoint activation
          dangerouslySetInnerHTML={{ __html: surfaceInitScript }}
        />
      </head>
      <body>
        <SurfaceProvider />
        <RootProvider
          theme={{
            defaultTheme: "system",
            attribute: ["class", "data-theme"],
            enableColorScheme: true,
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
