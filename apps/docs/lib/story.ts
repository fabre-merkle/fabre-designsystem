import { defineStoryFactory } from "@fumadocs/story/next/client";
import { WithControl } from "../components/docs/story/with-control";

/**
 * The docs story factory: every `*.story.tsx` file calls `defineStory` from here. Stories use the
 * project's own controls panel (`components/docs/story/`), themed by the Fumadocs token bridge
 * (`fd-*` colours).
 */
export const { defineStory } = defineStoryFactory({ WithControl });
