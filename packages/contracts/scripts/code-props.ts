/**
 * Read a component's props from its own TypeScript type, with the compiler. Dev and CLI only (it
 * needs `typescript`), so it lives beside the scripts, not in the dependency-free `src` module.
 */
import ts from "typescript";
import type { CodeProps, CodePropType } from "../src/code-connect/types";

/** Classify one prop type into what a Code Connect template needs to know. */
function classify(
  checker: ts.TypeChecker,
  type: ts.Type,
): { type: CodePropType; literals?: string[] } {
  if (checker.typeToString(type).includes("ReactNode")) return { type: "node" };
  const bare = checker.getNonNullableType(type);
  if (bare.flags & ts.TypeFlags.BooleanLike) return { type: "boolean" };
  const members = bare.isUnion() ? bare.types : [bare];
  const literals = members
    .filter((t) => t.isStringLiteral())
    .map((t) => (t as ts.StringLiteralType).value);
  if (literals.length > 0 && literals.length === members.length) return { type: "union", literals };
  if (bare.flags & ts.TypeFlags.StringLike) return { type: "string" };
  return { type: "other" };
}

/** Reads component props from one shared TypeScript program. */
export interface CodePropsReader {
  /**
   * The props of the component exported as `exportName` from `file`, keyed by name. A function
   * component's props are its first parameter; a compound component (an object with a `Root`) uses
   * `Root`'s. Throws when the file or the export cannot be read, so a missing component is a refusal.
   */
  read(file: string, exportName: string, member?: string): CodeProps;
  /**
   * The same props plus the JSX tag that renders the component: `exportName` itself, or
   * `exportName.Root` for a compound component, whose export is a namespace object. With a
   * `member`, the component is that property of the namespace (`Field` + `Label`), and the tag
   * is `Field.Label`.
   */
  resolve(
    file: string,
    exportName: string,
    member?: string,
  ): { props: CodeProps; renderTag: string };
}

/**
 * Build one TypeScript program over every component entry file a run needs and reuse its checker.
 * Creating a program per component re-parses React, Base UI and the shared types each time, so a
 * run over many components must create the reader once, with all its files.
 */
export function createCodePropsReader(files: readonly string[]): CodePropsReader {
  const program = ts.createProgram([...files], {
    jsx: ts.JsxEmit.ReactJSX,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ESNext,
    skipLibCheck: true,
    noEmit: true,
    strict: true,
    types: [],
  });
  const checker = program.getTypeChecker();
  /** Resolve the props and the render tag; the shared body of `read` and `resolve`. */
  function resolve(
    file: string,
    exportName: string,
    member?: string,
  ): { props: CodeProps; renderTag: string } {
    {
      const source = program.getSourceFile(file);
      if (!source) throw new Error(`Cannot read component source ${file}.`);
      const moduleSymbol = checker.getSymbolAtLocation(source);
      let exported =
        moduleSymbol && checker.getExportsOfModule(moduleSymbol).find((s) => s.name === exportName);
      if (!exported) throw new Error(`${file} does not export "${exportName}".`);
      if (exported.flags & ts.SymbolFlags.Alias) exported = checker.getAliasedSymbol(exported);
      let componentType = checker.getTypeOfSymbolAtLocation(exported, source);
      let signature = checker.getSignaturesOfType(componentType, ts.SignatureKind.Call)[0];
      let renderTag = exportName;
      if (member) {
        const part = componentType.getProperty(member);
        if (!part) throw new Error(`"${exportName}" in ${file} has no member "${member}".`);
        componentType = checker.getTypeOfSymbolAtLocation(part, source);
        signature = checker.getSignaturesOfType(componentType, ts.SignatureKind.Call)[0];
        renderTag = `${exportName}.${member}`;
      } else if (!signature) {
        const root = componentType.getProperty("Root");
        if (root) {
          componentType = checker.getTypeOfSymbolAtLocation(root, source);
          signature = checker.getSignaturesOfType(componentType, ts.SignatureKind.Call)[0];
          renderTag = `${exportName}.Root`;
        }
      }
      const param = signature?.getParameters()[0];
      if (!param) {
        throw new Error(
          `"${renderTag}" in ${file} is not a component with props (no call signature or Root).`,
        );
      }
      const propsType = checker.getTypeOfSymbolAtLocation(param, source);
      const props: CodeProps = {};
      for (const prop of checker.getPropertiesOfType(propsType)) {
        props[prop.name] = classify(checker, checker.getTypeOfSymbolAtLocation(prop, source));
      }
      return { props, renderTag };
    }
  }
  return {
    read: (file, exportName, member) => resolve(file, exportName, member).props,
    resolve,
  };
}

/** One-off read of a single component. Prefer `createCodePropsReader` when reading several. */
export function readCodeProps(file: string, exportName: string): CodeProps {
  return createCodePropsReader([file]).read(file, exportName);
}
