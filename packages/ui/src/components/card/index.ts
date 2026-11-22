// The namespace object is assembled HERE, in a module with no "use client"
// directive (the parts live in the "use client" card.tsx), so a React Server
// Component importing `Card` receives a real object whose `.Root` (etc.) are
// renderable client references.
import { Action, Content, Description, Footer, Header, Root, Title } from "./card";

export type { CardPartProps, CardProps, CardSize } from "./card";

export const Card = {
  Root,
  Header,
  Title,
  Description,
  Action,
  Content,
  Footer,
};
