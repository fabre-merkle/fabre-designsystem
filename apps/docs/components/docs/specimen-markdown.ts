import { asMarkdown } from "fumadocs-core/server";

function specimen(text: string) {
  return () => {
    asMarkdown();
    return `\n${text}\n\n`;
  };
}

export const specimenMarkdownComponents = {
  ColourExample: specimen(
    "The visual example compares the active brand, neutral and intent families.",
  ),
  TypographyExamples: specimen(
    "The visual example compares the active display, headline, paragraph and code families.",
  ),
  SpacingExample: specimen(
    "The visual example compares the active spacing rhythm from close relationships to larger regions.",
  ),
  ElevationExample: specimen(
    "The interactive example compares surface and shadow levels independently and shows nested and recessed regions.",
  ),
  MotionExamples: specimen(
    "The interactive examples demonstrate transitions using the active project's motion values and respect reduced-motion preferences.",
  ),
  BackdropExample: specimen(
    "The visual example compares the project's low, mid and high blur-and-saturation combinations.",
  ),
};
