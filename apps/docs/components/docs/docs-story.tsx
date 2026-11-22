import { getDocsStory } from "../../lib/docs-stories";
import { ComponentShowcase } from "./component-showcase";
import { DemoArgsProvider } from "./story/demo-args";

/**
 * A docs story on a page, used as the page hero: the component with prop-driven controls and its
 * TypeScript and CSS source in tabs, in place of a hand-written `ComponentShowcase`. `name` is the
 * story's key in `lib/docs-stories.ts`, and also the component's key in the component registry
 * that supplies the source tabs. Its Markdown form (`lib/docs-story-markdown.tsx`) lists the
 * presets for agents. The wrapper scopes the CSS that themes the panel and lays out the island each
 * demo renders inside.
 */
export function DocsStory({ name }: { name: string }) {
  const { story, demoArgs = [] } = getDocsStory(name);
  const { WithControl } = story;
  return (
    <ComponentShowcase name={name} bare>
      <div data-docs-story>
        <DemoArgsProvider names={demoArgs}>
          <WithControl />
        </DemoArgsProvider>
      </div>
    </ComponentShowcase>
  );
}
