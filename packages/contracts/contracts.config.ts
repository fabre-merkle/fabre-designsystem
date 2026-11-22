export interface DocumentationTheme {
  defaultMode: string;
  page: string;
  section: string;
  text: string;
  textSubtle: string;
  divider: string;
  radius: string;
  rowGap: string;
  contentGap: string;
  sectionGap: string;
  pageGutter: string;
  titleStyle: string;
  bodyStyle: string;
  captionStyle: string;
}

export const documentationTheme: DocumentationTheme = {
  defaultMode: "Light",
  page: "color/surface/body",
  section: "color/surface/recessed",
  text: "color/onSurface",
  textSubtle: "color/onSurface/subtle",
  divider: "color/surface/border/1",
  radius: "radius/default",
  rowGap: "spacing/050",
  contentGap: "spacing/400",
  sectionGap: "spacing/600",
  pageGutter: "spacing/800",
  titleStyle: "text-style/display/sm",
  bodyStyle: "text-style/paragraph/md",
  captionStyle: "text-style/legal",
};

export interface DocumentationPage {
  /** Origin + path prefix of the component docs; the page links to `${docsBaseUrl}/<slug>`. */
  docsBaseUrl?: string;
  /** Wordmark shown in the page header. */
  brandName?: string;
}

// Set docsBaseUrl (e.g. "https://<your-docs-domain>/docs/components") once your docs app is deployed.
export const documentationPage: DocumentationPage = {
  brandName: "fabre-DesignSystem",
};

// Where the components live, relative to the workspace root. Set explicitly because the root
// components.json points its `ui` alias at the docs app, which is not where the library lives.
export const componentsDir = "packages/ui/src/components";

// Raw DTCG token sets (a Tokens Studio raw pull) the compiler reads token values from.
export const tokensDir = "packages/tokens/dtcg";
