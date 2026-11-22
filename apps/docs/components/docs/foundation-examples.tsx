"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Popover as BasePopover } from "@base-ui/react/popover";
import {
  type ComponentProps,
  type ComponentType,
  type CSSProperties,
  createContext,
  type ElementType,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

function TypographySample({
  role,
  sample,
  family,
}: {
  role: string;
  sample: string;
  family: string;
}) {
  const text = useRef<HTMLParagraphElement>(null);
  const [font, setFont] = useState<string>();

  useEffect(() => {
    const element = text.current;
    if (!element) return;
    const update = () => setFont(getComputedStyle(element).fontFamily);
    update();
    const observer = new MutationObserver(update);
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true });
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="docs-example-type-sample">
      <header>
        <strong>{role}</strong>
        <small>Font: {font ?? "Resolving active font…"}</small>
      </header>
      <p
        ref={text}
        style={{
          fontFamily: `var(--typography-${family}-md-font-family)`,
          fontSize: `var(--typography-${family}-md-font-size)`,
          fontWeight: `var(--typography-${family}-md-font-weight)`,
          lineHeight: `var(--typography-${family}-md-line-height)`,
        }}
      >
        {sample}
      </p>
    </div>
  );
}

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
type Level = (typeof LEVELS)[number];

export type ExampleSurfaceProps = {
  level: Level;
  shadowLevel: Level;
  children: ReactNode;
  className?: string;
};

export type ExampleChoiceProps = {
  label: string;
  value: string;
  options: readonly { label: string; value: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
};
export type ExampleToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};
export type ExampleButtonProps = ComponentProps<"button"> & {
  appearance?: "primary" | "secondary";
};

function Choice({ label, value, options, disabled, onChange }: ExampleChoiceProps) {
  return (
    <label className="docs-example-choice">
      {label}
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: ExampleToggleProps) {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function Action({ appearance = "secondary", ...props }: ExampleButtonProps) {
  return (
    <button type="button" className="docs-example-action" data-appearance={appearance} {...props} />
  );
}

const exampleComponents = {
  Choice,
  Toggle,
  Action,
  Surface: TokenSurface,
  Panel: TokenSurface,
};
const ExampleComponents = createContext<{
  Choice: ComponentType<ExampleChoiceProps>;
  Toggle: ComponentType<ExampleToggleProps>;
  Action: ComponentType<ExampleButtonProps>;
  Surface: ComponentType<ExampleSurfaceProps>;
  Panel: ComponentType<ExampleSurfaceProps>;
}>(exampleComponents);

export const ExampleComponentsProvider = ExampleComponents.Provider;
export function useExampleComponents() {
  return useContext(ExampleComponents);
}

type Parts<T, K extends keyof T> = {
  [P in K]: T[P] extends ElementType ? ComponentType<ComponentProps<T[P]>> : never;
};

export type ExamplePopover = Parts<
  typeof BasePopover,
  "Root" | "Trigger" | "Portal" | "Positioner" | "Popup" | "Title"
>;
export type ExampleMenu = Parts<
  typeof BaseMenu,
  | "Root"
  | "Trigger"
  | "Portal"
  | "Positioner"
  | "Popup"
  | "RadioGroup"
  | "RadioItem"
  | "RadioItemIndicator"
  | "Item"
>;

function surfaceStyle(level: Level, shadowLevel: Level): CSSProperties {
  const edge = Math.min(level + 1, 8);
  return {
    background: `var(--color-surface-level-${level})`,
    borderColor: level === 1 ? "transparent" : `var(--color-surface-border-${edge})`,
    boxShadow: level === 1 ? "none" : `var(--shadow-level-${shadowLevel})`,
  };
}

function TokenSurface({ level, shadowLevel, children, className = "" }: ExampleSurfaceProps) {
  return (
    <div
      className={`docs-example-surface docs-example-surface--token ${className}`}
      style={surfaceStyle(level, shadowLevel)}
    >
      {children}
    </div>
  );
}

export function ColourExample() {
  const groups = [
    {
      label: "Brand colours",
      name: "brand",
      families: [
        ["Primary", "--brand-color-base-primary"],
        ["Secondary", "--brand-color-base-secondary"],
        ["Tertiary", "--brand-color-base-tertiary"],
      ],
    },
    {
      label: "Neutrals",
      name: "neutral",
      families: [
        ["Light-mode neutral", "--brand-color-base-neutral-light"],
        ["Dark-mode neutral", "--brand-color-base-neutral-dark"],
      ],
    },
    {
      label: "Utilities",
      name: "utility",
      families: [
        ["Error", "--brand-color-base-utility-error"],
        ["Warning", "--brand-color-base-utility-warning"],
        ["Success", "--brand-color-base-utility-success"],
        ["Information", "--brand-color-base-utility-info"],
      ],
    },
  ] as const;
  return (
    <div data-focus-island className="docs-example docs-example-colours not-prose">
      {groups.map((group) => (
        <section key={group.name} data-palette-group={group.name}>
          <h3>{group.label}</h3>
          <ul>
            {group.families.map(([label, variable]) => (
              <li key={variable}>
                <span aria-hidden style={{ background: `var(${variable})` }} />
                <strong>{label}</strong>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function TypographyExamples() {
  const examples = [
    { role: "Display", sample: "A clear introduction", family: "display" },
    { role: "Headline", sample: "A meaningful heading", family: "headline" },
    {
      role: "Paragraph",
      sample: "Readable text makes information easier to understand.",
      family: "paragraph",
    },
    { role: "Code", sample: "const example = true;", family: "code" },
  ] as const;
  return (
    <div data-focus-island className="docs-example docs-example-type not-prose">
      {examples.map((example) => (
        <TypographySample key={example.role} {...example} />
      ))}
    </div>
  );
}

export function SpacingExample() {
  const examples = [
    ["Close", "100"],
    ["Within a group", "300"],
    ["Between groups", "600"],
    ["Between regions", "1000"],
  ] as const;
  return (
    <div data-focus-island className="docs-example docs-example-spacing not-prose">
      {examples.map(([label, step]) => (
        <div key={step}>
          <span>{label}</span>
          <span aria-hidden style={{ width: `var(--spacing-${step})` }} />
        </div>
      ))}
    </div>
  );
}

function readLevel(value: string): Level | undefined {
  return LEVELS.find((level) => level === Number(value));
}

function raised(level: Level, offset: number): Level {
  return LEVELS[Math.min(level - 1 + offset, LEVELS.length - 1)];
}

export function ElevationExample({
  Popover = BasePopover,
  Menu = BaseMenu,
}: {
  Popover?: ExamplePopover;
  Menu?: ExampleMenu;
} = {}) {
  const { Surface, Choice, Toggle, Action } = useExampleComponents();
  const [level, setLevel] = useState<Level>(3);
  const [shadow, setShadow] = useState<Level>(3);
  const [linked, setLinked] = useState(true);
  const [sharingOpen, setSharingOpen] = useState(true);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [permission, setPermission] = useState("Can edit");
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const permissionTrigger = useRef<HTMLButtonElement>(null);
  const useTokenSurfaces = Surface === TokenSurface;
  const permissions = ["Can edit", "Can comment", "Can view"];
  const keepOpenWhileAdjusting = (next: boolean, details: { reason?: string }) =>
    !next && (details.reason === "outside-press" || details.reason === "focus-out");
  return (
    <div data-focus-island className="docs-example docs-example-depth not-prose">
      <div className="docs-example-controls">
        <Choice
          label="Surface level"
          value={String(level)}
          options={LEVELS.map((value) => ({ label: String(value), value: String(value) }))}
          onChange={(value) => {
            const next = readLevel(value);
            if (next !== undefined) {
              setLevel(next);
              if (linked) setShadow(next);
            }
          }}
        />
        <Choice
          label="Shadow level"
          value={String(shadow)}
          disabled={linked}
          options={LEVELS.map((value) => ({ label: String(value), value: String(value) }))}
          onChange={(value) => {
            const next = readLevel(value);
            if (next !== undefined) setShadow(next);
          }}
        />
        <Toggle
          label="Link levels"
          checked={linked}
          onChange={(checked) => {
            setLinked(checked);
            if (checked) setShadow(level);
          }}
        />
      </div>
      <div
        className="docs-example-depth-stage"
        data-open={sharingOpen ? "" : undefined}
        ref={setStage}
      >
        <Surface level={level} shadowLevel={shadow}>
          <div className="docs-example-depth-heading">
            <strong>Project card</strong>
            <Popover.Root
              open={sharingOpen}
              onOpenChange={(next, details) => {
                if (keepOpenWhileAdjusting(next, details)) return;
                setSharingOpen(next);
                if (!next) setPermissionsOpen(false);
              }}
            >
              <Popover.Trigger aria-label="Share the project" render={<Action />}>
                Share
              </Popover.Trigger>
              {stage ? (
                <Popover.Portal container={stage}>
                  <Popover.Positioner side="bottom" align="end" sideOffset={8}>
                    <Popover.Popup
                      initialFocus={false}
                      className={`docs-example-surface${useTokenSurfaces ? " docs-example-surface--token" : ""}`}
                      style={{
                        position: "relative",
                        ...(useTokenSurfaces ? surfaceStyle(raised(level, 2), 3) : {}),
                      }}
                    >
                      <Popover.Title>Sharing panel</Popover.Title>
                      <p>This panel rises from its surroundings.</p>
                      <Menu.Root
                        modal={false}
                        open={permissionsOpen}
                        onOpenChange={(next, details) => {
                          if (!keepOpenWhileAdjusting(next, details)) setPermissionsOpen(next);
                        }}
                      >
                        <Menu.Trigger ref={permissionTrigger} render={<Action />}>
                          {permission}
                        </Menu.Trigger>
                        {/* A sibling portal keeps the popover from reclaiming focus when the menu closes. */}
                        {stage ? (
                          <Menu.Portal container={stage}>
                            <Menu.Positioner
                              positionMethod="fixed"
                              side="bottom"
                              align="end"
                              sideOffset={8}
                            >
                              <Menu.Popup
                                aria-label="Example collaborator permission"
                                finalFocus={permissionTrigger}
                                className={`docs-example-surface${useTokenSurfaces ? " docs-example-surface--token" : ""}`}
                                style={
                                  useTokenSurfaces ? surfaceStyle(raised(level, 4), 3) : undefined
                                }
                              >
                                <Menu.RadioGroup
                                  value={permission}
                                  onValueChange={(value) => {
                                    if (typeof value === "string" && permissions.includes(value)) {
                                      setPermission(value);
                                    }
                                  }}
                                >
                                  {permissions.map((value) => (
                                    <Menu.RadioItem
                                      key={value}
                                      value={value}
                                      closeOnClick={false}
                                      className="docs-example-depth-option"
                                    >
                                      <Menu.RadioItemIndicator className="docs-example-depth-indicator" />
                                      {value}
                                    </Menu.RadioItem>
                                  ))}
                                </Menu.RadioGroup>
                                <Menu.Item
                                  nativeButton
                                  data-ui="button"
                                  render={<Action appearance="primary" />}
                                >
                                  Accept
                                </Menu.Item>
                              </Menu.Popup>
                            </Menu.Positioner>
                          </Menu.Portal>
                        ) : null}
                      </Menu.Root>
                      <div className="docs-example-recess">
                        Link access is recessed within the panel.
                      </div>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              ) : null}
            </Popover.Root>
          </div>
          <p>A raised region groups related information.</p>
        </Surface>
      </div>
      <p className="docs-example-depth-note">This example does not share a real project.</p>
    </div>
  );
}

type MotionRole = "default" | "enter" | "exit" | "expand" | "move";

function MotionExample({ role, label }: { role: MotionRole; label: string }) {
  const { Action, Panel } = useExampleComponents();
  const [active, setActive] = useState(role === "exit");
  const id = useId();
  const visible = role === "enter" || role === "exit" ? active : true;
  const properties: CSSProperties = {
    transitionDuration: `var(--transition-${role}-duration)`,
    transitionTimingFunction: `var(--transition-${role}-easing)`,
    opacity: visible ? 1 : 0,
    transform:
      role === "enter" || role === "exit"
        ? active
          ? "translateY(0)"
          : "translateY(0.75rem)"
        : undefined,
  };
  const description = {
    default: "A control acknowledges a change without interrupting the task.",
    enter: "Introduce details next to the action that reveals them.",
    exit: "Dismiss confirmation without holding up the next task.",
    expand: "Make room for another item while preserving the order.",
    move: "Keep a task recognisable as it changes position.",
  }[role];
  const action = {
    default: active ? "Unfollow project" : "Follow project",
    enter: active ? "Hide details" : "Show details",
    exit: active ? "Dismiss confirmation" : "Restore confirmation",
    expand: active ? "Remove added item" : "Add item",
    move: active ? "Move to in progress" : "Mark as done",
  }[role];
  return (
    <article className="docs-example-motion-card" data-motion-role={role}>
      <h3>{label}</h3>
      <div
        id={id}
        className="docs-example-motion-stage"
        style={properties}
        aria-hidden={!visible}
        inert={!visible}
      >
        {role === "expand" ? (
          <ul className="docs-example-task-list" aria-label="Example project tasks">
            <li>
              <Panel level={3} shadowLevel={1}>
                <span>Plan</span>
              </Panel>
            </li>
            <li
              className="docs-example-motion-expand"
              data-expanded={active}
              aria-hidden={!active}
              style={{ ...properties, gridTemplateRows: active ? "1fr" : "0fr" }}
            >
              <div>
                <Panel level={3} shadowLevel={1}>
                  <span>Review</span>
                </Panel>
              </div>
            </li>
            <li>
              <Panel level={3} shadowLevel={1}>
                <span>Launch</span>
              </Panel>
            </li>
          </ul>
        ) : role === "move" ? (
          <div className="docs-example-board">
            <span>In progress</span>
            <span>Done</span>
            <div
              className="docs-example-board-task"
              style={{ ...properties, transform: `translateX(${active ? "100%" : "0"})` }}
            >
              <Panel level={3} shadowLevel={1}>
                <strong>Brand refresh</strong>
                <small>Project task</small>
              </Panel>
            </div>
          </div>
        ) : (
          <Panel level={3} shadowLevel={1}>
            <strong>{role === "exit" ? "Changes saved" : "Project details"}</strong>
            <p>
              {role === "exit" ? "Your work is up to date." : "Brand refresh · Ready for review"}
            </p>
            {role === "default" ? (
              <span
                className="docs-example-follow-state"
                style={{
                  ...properties,
                  background: active
                    ? "var(--color-primary-brand)"
                    : "var(--color-surface-recessed)",
                  color: active ? "var(--color-primary-on-brand)" : "var(--color-on-surface)",
                }}
              >
                {active ? "Following" : "Not following"}
              </span>
            ) : null}
          </Panel>
        )}
      </div>
      <p>{description}</p>
      <Action
        aria-controls={id}
        aria-expanded={role === "enter" || role === "expand" ? active : undefined}
        onClick={() => setActive((previous) => !previous)}
      >
        {action}
      </Action>
    </article>
  );
}

export function MotionExamples({ introductory = false }: { introductory?: boolean }) {
  const examples: { role: MotionRole; label: string }[] = introductory
    ? [
        { role: "enter", label: "Entering" },
        { role: "exit", label: "Exiting" },
        { role: "expand", label: "Adding" },
      ]
    : [
        { role: "default", label: "Default" },
        { role: "enter", label: "Enter" },
        { role: "exit", label: "Exit" },
        { role: "expand", label: "Expand" },
        { role: "move", label: "Move" },
      ];
  return (
    <div data-focus-island className="docs-example docs-example-motion not-prose">
      {examples.map((example) => (
        <MotionExample key={example.role} {...example} />
      ))}
    </div>
  );
}

export function BackdropExample() {
  const { Choice, Toggle, Panel } = useExampleComponents();
  const [strength, setStrength] = useState("mid");
  const [enabled, setEnabled] = useState(true);
  const levels = [
    { value: "low", label: "Low" },
    { value: "mid", label: "Medium" },
    { value: "high", label: "High" },
  ];
  return (
    <div data-focus-island className="docs-example not-prose">
      <div className="docs-example-controls">
        <Choice
          label="Backdrop strength"
          value={strength}
          options={levels}
          onChange={setStrength}
        />
        <Toggle label="Show backdrop" checked={enabled} onChange={setEnabled} />
      </div>
      <div
        className="docs-example-backdrop-scene"
        data-backdrop-strength={strength}
        data-backdrop-enabled={enabled}
      >
        <div className="docs-example-backdrop-content">
          <Panel level={3} shadowLevel={1}>
            <strong>Brand refresh</strong>
            <p>Project overview</p>
          </Panel>
          <div className="docs-example-backdrop-swatches" aria-hidden>
            <span />
            <span />
            <span />
          </div>
        </div>
        <div
          className="docs-example-backdrop-film"
          style={{
            backdropFilter: enabled
              ? `blur(var(--backdrop-${strength}-blur)) saturate(var(--backdrop-${strength}-saturate))`
              : "none",
          }}
        >
          <strong>Project navigation</strong>
          <span>Overview</span>
          <span>Design files</span>
          <span>Activity</span>
          <small>
            {enabled ? levels.find((level) => level.value === strength)?.label : "No"} backdrop
          </small>
        </div>
      </div>
      <p className="docs-example-depth-note">
        Compare the same content with low, medium and high backdrop strength, or turn the effect
        off.
      </p>
    </div>
  );
}
