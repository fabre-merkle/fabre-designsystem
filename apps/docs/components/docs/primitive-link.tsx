import "./primitive-link.css";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";

interface PrimitiveLinkProps {
  href: string;
}

export function PrimitiveLink({ href }: PrimitiveLinkProps) {
  // `href` comes from page frontmatter (`primitive:`). Only allow http(s) so a
  // malformed/hostile value can't become a javascript:/data: link.
  if (!/^https?:\/\//i.test(href)) return null;

  const path = href.split(/[?#]/)[0].replace(/\/+$/, "");
  const segment = path.split("/").pop() ?? "";
  const name = segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <a data-ui="primitive-link" href={href} target="_blank" rel="noopener noreferrer">
      View {name} Base UI Docs
      <ArrowSquareOut data-ui="primitive-link-icon" weight="bold" />
    </a>
  );
}
