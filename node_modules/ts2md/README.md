# ts2md

Simple Typescript Documentation in `README.md` Generator

The focus of this generator is single output file, low effort, low maintenance, high accuracy API documentation generation.

Many JSDoc tags are ignored as not relevant to this objective. Some custom tags have been added.

For a full featured, fine grain typescript documentation generator see [TypeDoc](https://typedoc.org/)

A good starting point in the API doc is the [ts2md function](#function-ts2md) and then the [TypescriptToMarkDown class](#class-typescripttomarkdown).

## Supported JSDoc Tags

The following JSDoc tags are supported:

| Tag | Description |
|---|---|
| @example | Adds example as code block or comments and embedded code block(s). |
| @param | Adds comment for function or method parameter. |
| @private | Hides an otherwise accessible documentation item. |
| @privateinitializer | Hides property initializer from documentation typescript. |
| @property | Adds comment for class or interface property parameter in parent's JSDoc comment. |
| @publicbody | Overrides the normal hidding of method and function bodies. |
| @returns | Adds comment for function or method return value. |
| @throws | Adds thrown error comment to function or method. |

## Installation

```bash
npm i -D ts2md
```

## Setup

After installation, use the following command to run markdown generation:

```bash
npx ts2md
```

Which will also remind you to add merge anchors in your `README.md` file:

```md
  <!--#region ts2md-api-merged-here-->
  <!--#endregion ts2md-api-merged-here-->
```

The anchors must not be indented where you wish to merge the generated documentation.

You may also want to add a script to `package.json` as a reminder and to support
automatically updating documentation before publishing your package:

```json
  "scripts": {
    "build:readme": "npx ts2md",
    "prepublish": "npm run build && npx ts2md",
  }
```

A good starting point in the API doc is the [ts2md function](#function-ts2md) and then the [Ts2Md class](#class-ts2md).

## API

<!--#region ts2md-api-merged-here-->

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

### Interfaces

| |
| --- |
| [DocGenSupportApi](#interface-docgensupportapi) |
| [JSDocInfo](#interface-jsdocinfo) |
| [Ts2MdOptions](#interface-ts2mdoptions) |

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---

#### Interface: DocGenSupportApi

```ts
export interface DocGenSupportApi {
    printer: ts.Printer;
    nothingPrivate: boolean;
    noDetailsSummary: boolean;
    headingLevelMd(relativeLevel: number): string;
}
```

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Interface: JSDocInfo

Parsed JSDoc info associated with a documentation item

```ts
export interface JSDocInfo {
    isPrivate: boolean;
    publicBody: boolean;
    privateInitializer: boolean;
    comments: string[];
    params: ts.JSDocParameterTag[];
    returns: ts.JSDocReturnTag[];
    throws: ts.JSDocThrowsTag[];
    examples: string[];
    properties: Record<string, string>;
    tags: ts.Node[];
    other: ts.Node[];
}
```

<details>

<summary>Interface JSDocInfo Details</summary>

##### Property comments

JSDoc nodes with ['comment'] strings not otherwise tagged with a recognized tag.

```ts
comments: string[]
```

##### Property examples

The

```ts
examples: string[]
```

Example

```ts
tag comments. Comments without code blocks are assumed to be typescript codeblocks
```

##### Property isPrivate

true if has '@private' tag

```ts
isPrivate: boolean
```

##### Property other

JSDoc nodes not parsed into other properties

```ts
other: ts.Node[]
```

##### Property params

The

```ts
params: ts.JSDocParameterTag[]
```

##### Property privateInitializer

true if has '@privateinitializer' tag

```ts
privateInitializer: boolean
```

##### Property properties

The

```ts
properties: Record<string, string>
```

##### Property publicBody

true if has '@publicbody' tag

```ts
publicBody: boolean
```

##### Property returns

JSDoc nodes tagged with '@returns'

```ts
returns: ts.JSDocReturnTag[]
```

##### Property tags

JSDoc tags not parsed into other properties

```ts
tags: ts.Node[]
```

##### Property throws

JSDoc nodes tagged with '@throws'

```ts
throws: ts.JSDocThrowsTag[]
```

</details>

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Interface: Ts2MdOptions

Options for the `Ts2Md` class which generates Typescript documentation.

```ts
export interface Ts2MdOptions {
    options?: Ts2MdOptions[];
    inputFilename: string;
    firstHeadingLevel: 1 | 2 | 3;
    noTitle: boolean;
    outputFilename?: string;
    readmeMerge: boolean;
    nothingPrivate?: boolean;
    filenameSubString?: string;
    noDetailsSummary?: boolean;
}
```

<details>

<summary>Interface Ts2MdOptions Details</summary>

##### Property filenameSubString

If specified, only symbols defined in files with this value as a substring
are included in generated markdown.

'/' must be used as the folder separator.

```ts
filenameSubString?: string
```

##### Property firstHeadingLevel

The heading level for the first generated heading.

```ts
firstHeadingLevel: 1 | 2 | 3
```

##### Property inputFilename

Primary typescript source file, default is `./src/index.ts`

```ts
inputFilename: string
```

##### Property noDetailsSummary

GitHub Pages, and other consumers of markdown, may not support the
<details> and <summary> tags embedded in markdown.

Set `noDetailsSummary` to true to skip wrapping details with this tag.

```ts
noDetailsSummary?: boolean
```

##### Property noTitle

Set to true if generated markdown will be merged into
a file that already includes a containing header.

```ts
noTitle: boolean
```

##### Property nothingPrivate

If true, overrides private typescript keywords and jsdoc tags.

CAUTION: This setting is inappropriate for published documentation ;-)

```ts
nothingPrivate?: boolean
```

##### Property outputFilename

If valid, a copy of the generated markdown documentation will be
saved to this file.

```ts
outputFilename?: string
```

##### Property readmeMerge

Set to true if the generated output should be merged into README.md

Currently README.md must exist at `./README.md`

and must contain the following merge start and merge end anchors:

   `<!--#region ts2md-api-merged-here-->`

   `<!--#endregion ts2md-api-merged-here-->`

The anchors must not be indented.

```ts
readmeMerge: boolean
```

</details>

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
### Classes

| | |
| --- | --- |
| [DocBase](#class-docbase) | [DocMethod](#class-docmethod) |
| [DocClass](#class-docclass) | [DocMethodSignature](#class-docmethodsignature) |
| [DocConstructor](#class-docconstructor) | [DocProperty](#class-docproperty) |
| [DocEnum](#class-docenum) | [DocPropertySignature](#class-docpropertysignature) |
| [DocEnumMember](#class-docenummember) | [DocType](#class-doctype) |
| [DocFunction](#class-docfunction) | [DocVariable](#class-docvariable) |
| [DocInterface](#class-docinterface) | [TypescriptToMarkdown](#class-typescripttomarkdown) |
| [DocItem](#class-docitem) |  |

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---

#### Class: DocBase

```ts
export abstract class DocBase<T extends ts.Node> {
    docItems: DocItem<T>[] = [];
    constructor(public sup: DocGenSupportApi, public label: string, public labelPlural: string, public detailsLabel = "Details") 
    abstract getName(item: T, sf: ts.SourceFile): string;
    abstract filterItem(s: ts.Node): T[];
    tryAddItem(s: ts.Node, sf: ts.SourceFile, parent?: DocItem<ts.Node>) 
    extractMemberDocs(docItem: DocItem<ts.Node>): DocBase<ts.Node>[] 
    isNotPrivate(item: ts.Node): boolean 
    findTs(findInTs: string, targetTs: string): {
        pos: number;
        len: number;
    } 
    removeTs(fromTs: string, removeTs: string, withSemi?: boolean): string 
    toSeeAlso(docItem: DocItem<T>, mdts: string, mdLinks: Record<string, string>, tight?: boolean): string 
    toTsMarkDown(docItem: DocItem<T>, mdLinks: Record<string, string>, tight?: boolean): string 
    toMarkDown(docItem: DocItem<T>, mdLinks: Record<string, string>): string 
    toMarkDownTs(docItem: DocItem<T>): string 
    toMarkDownDetails(docItem: DocItem<T>, mdLinks: Record<string, string>): string 
    toMarkDownRefLink(docItem: DocItem<T>): string 
    isExportedDeclaration(item: ts.Declaration): boolean 
    argumentsDetails(docItem: DocItem<T>): string 
    returnsDetails(docItem: DocItem<T>): string 
    throwsDetails(docItem: DocItem<T>): string 
    examplesDetails(docItem: DocItem<T>): string 
    commentsDetails(docItem: DocItem<T>): string 
}
```

See also: [DocGenSupportApi](#interface-docgensupportapi), [DocItem](#class-docitem)

<details>

<summary>Class DocBase Details</summary>

##### Method toMarkDown

Base class implementation of markdown generation for a top level typescript AST node (`DocItem`).

Adds relative level 3 heading with `label` and `docItem.name`

Adds the nodes simple (no `@` tag) JSDoc nodes under relative level 4 'Description` heading

Calls the `toMarkDownTs` override to add the typescript syntax code block for this node.

Calls the `toMarkDownDtails` override to add any details markdown for this node.

```ts
toMarkDown(docItem: DocItem<T>, mdLinks: Record<string, string>): string 
```
See also: [DocItem](#class-docitem)

Returns

the generated markdown for this `DocItem`

##### Method toMarkDownDetails

Generate the 'Details' markdown (including ) for this node.

Base class implementation returns an empty string.

```ts
toMarkDownDetails(docItem: DocItem<T>, mdLinks: Record<string, string>): string 
```
See also: [DocItem](#class-docitem)

##### Method toMarkDownTs

Generate the typescript syntax for this node to be inserted in a typescript syntax code block
in generated markdown.

Base class implementation uses the typescript compiler printer on `DocItem` AST node `item`.

CAUTION: This adds ALL the source code for this item to the generated markdown. Override SHOULD
implement appropriate ommission control policies.

```ts
toMarkDownTs(docItem: DocItem<T>): string 
```
See also: [DocItem](#class-docitem)

Returns

typescript syntax to be added within a typescript syntax code block for this `DocItem`

</details>

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Class: DocClass

```ts
export class DocClass extends DocBase<ts.ClassDeclaration> {
    constructor(sup: DocGenSupportApi) 
    override getName(item: ts.ClassDeclaration): string 
    override filterItem(item: ts.Node): ts.ClassDeclaration[] 
    override extractMemberDocs(docItem: DocItem<ts.ClassDeclaration>): DocBase<ts.Node>[] 
    override toMarkDownTs(docItem: DocItem<ts.ClassDeclaration>): string 
    override toMarkDownDetails(docItem: DocItem<ts.ClassDeclaration>, mdLinks: Record<string, string>): string 
}
```

See also: [DocBase](#class-docbase), [DocGenSupportApi](#interface-docgensupportapi), [DocItem](#class-docitem)

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Class: DocConstructor

```ts
export class DocConstructor extends DocBase<ts.ConstructorDeclaration> {
    constructor(sup: DocGenSupportApi) 
    override getName(item: ts.ConstructorDeclaration): string 
    override filterItem(item: ts.Node): ts.ConstructorDeclaration[] 
    override toMarkDownTs(docItem: DocItem<ts.ConstructorDeclaration>): string 
    override toMarkDownDetails(docItem: DocItem<ts.ConstructorDeclaration>, mdLinks: Record<string, string>): string 
}
```

See also: [DocBase](#class-docbase), [DocGenSupportApi](#interface-docgensupportapi), [DocItem](#class-docitem)

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Class: DocEnum

```ts
export class DocEnum extends DocBase<ts.EnumDeclaration> {
    constructor(sup: DocGenSupportApi) 
    override getName(item: ts.EnumDeclaration): string 
    override filterItem(item: ts.Node): ts.EnumDeclaration[] 
    override extractMemberDocs(docItem: DocItem<ts.EnumDeclaration>): DocBase<ts.Node>[] 
    override toMarkDownDetails(docItem: DocItem<ts.EnumDeclaration>, mdLinks: Record<string, string>): string 
}
```

See also: [DocBase](#class-docbase), [DocGenSupportApi](#interface-docgensupportapi), [DocItem](#class-docitem)

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Class: DocEnumMember

```ts
export class DocEnumMember extends DocBase<ts.EnumMember> {
    constructor(sup: DocGenSupportApi) 
    override getName(item: ts.EnumMember): string 
    override filterItem(item: ts.Node): ts.EnumMember[] 
    override toMarkDownDetails(docItem: DocItem<ts.EnumMember>, mdLinks: Record<string, string>): string 
}
```

See also: [DocBase](#class-docbase), [DocGenSupportApi](#interface-docgensupportapi), [DocItem](#class-docitem)

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Class: DocFunction

```ts
export class DocFunction extends DocBase<ts.FunctionDeclaration> {
    constructor(sup: DocGenSupportApi) 
    override getName(item: ts.FunctionDeclaration): string 
    override filterItem(item: ts.Node): ts.FunctionDeclaration[] 
    override toMarkDownTs(docItem: DocItem<ts.FunctionDeclaration>): string 
    override toMarkDownDetails(docItem: DocItem<ts.FunctionDeclaration>, mdLinks: Record<string, string>): string 
}
```

See also: [DocBase](#class-docbase), [DocGenSupportApi](#interface-docgensupportapi), [DocItem](#class-docitem)

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Class: DocInterface

```ts
export class DocInterface extends DocBase<ts.InterfaceDeclaration> {
    constructor(sup: DocGenSupportApi) 
    override getName(item: ts.InterfaceDeclaration): string 
    override filterItem(item: ts.Node): ts.InterfaceDeclaration[] 
    override extractMemberDocs(docItem: DocItem<ts.InterfaceDeclaration>): DocBase<ts.Node>[] 
    override toMarkDownDetails(docItem: DocItem<ts.InterfaceDeclaration>, mdLinks: Record<string, string>): string 
}
```

See also: [DocBase](#class-docbase), [DocGenSupportApi](#interface-docgensupportapi), [DocItem](#class-docitem)

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Class: DocItem

Wrapper for a Typescript `Node` of a specific derived type,
which is of interest for documentation generation.

```ts
export class DocItem<T extends ts.Node> {
    jsDoc: JSDocInfo;
    memberDocs: DocBase<ts.Node>[] = [];
    constructor(public item: T, public name: string, public sf: ts.SourceFile, public parent?: DocItem<ts.Node>) 
}
```

See also: [DocBase](#class-docbase), [JSDocInfo](#interface-jsdocinfo)

<details>

<summary>Class DocItem Details</summary>

##### Constructor

This is really here just for demonstration / testing purposes...

```ts
constructor(public item: T, public name: string, public sf: ts.SourceFile, public parent?: DocItem<ts.Node>) 
```
See also: [DocItem](#class-docitem)

Argument Details

+ **item**
  + The typescript Node for this doc item.
+ **name**
  + The name for this doc item.
+ **sf**
  + The source file which defined this item.

##### Property jsDoc

Parsed JSDoc information for this item

```ts
jsDoc: JSDocInfo
```
See also: [JSDocInfo](#interface-jsdocinfo)

##### Property memberDocs

Subsidiary documentation nodes when the node has members which
are themselves represented as documentation nodes.

```ts
memberDocs: DocBase<ts.Node>[] = []
```
See also: [DocBase](#class-docbase)

</details>

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Class: DocMethod

```ts
export class DocMethod extends DocBase<ts.MethodDeclaration> {
    constructor(sup: DocGenSupportApi) 
    override getName(item: ts.MethodDeclaration): string 
    override filterItem(item: ts.Node): ts.MethodDeclaration[] 
    override toMarkDownTs(docItem: DocItem<ts.MethodDeclaration>): string 
    override toMarkDownDetails(docItem: DocItem<ts.MethodDeclaration>, mdLinks: Record<string, string>): string 
}
```

See also: [DocBase](#class-docbase), [DocGenSupportApi](#interface-docgensupportapi), [DocItem](#class-docitem)

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Class: DocMethodSignature

```ts
export class DocMethodSignature extends DocBase<ts.MethodSignature> {
    constructor(sup: DocGenSupportApi) 
    override getName(item: ts.MethodSignature): string 
    override filterItem(item: ts.Node): ts.MethodSignature[] 
    override toMarkDownTs(docItem: DocItem<ts.MethodSignature>): string 
    override toMarkDownDetails(docItem: DocItem<ts.MethodSignature>, mdLinks: Record<string, string>): string 
}
```

See also: [DocBase](#class-docbase), [DocGenSupportApi](#interface-docgensupportapi), [DocItem](#class-docitem)

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Class: DocProperty

```ts
export class DocProperty extends DocBase<ts.PropertyDeclaration> {
    constructor(sup: DocGenSupportApi) 
    override getName(item: ts.PropertyDeclaration): string 
    override filterItem(item: ts.Node): ts.PropertyDeclaration[] 
    override toMarkDownDetails(docItem: DocItem<ts.PropertyDeclaration>, mdLinks: Record<string, string>): string 
}
```

See also: [DocBase](#class-docbase), [DocGenSupportApi](#interface-docgensupportapi), [DocItem](#class-docitem)

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Class: DocPropertySignature

```ts
export class DocPropertySignature extends DocBase<ts.PropertySignature> {
    constructor(sup: DocGenSupportApi) 
    override getName(item: ts.PropertySignature): string 
    override filterItem(item: ts.Node): ts.PropertySignature[] 
    override toMarkDownDetails(docItem: DocItem<ts.PropertySignature>, mdLinks: Record<string, string>): string 
}
```

See also: [DocBase](#class-docbase), [DocGenSupportApi](#interface-docgensupportapi), [DocItem](#class-docitem)

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Class: DocType

```ts
export class DocType extends DocBase<ts.TypeAliasDeclaration> {
    constructor(sup: DocGenSupportApi) 
    override getName(item: ts.TypeAliasDeclaration): string 
    override filterItem(item: ts.Node): ts.TypeAliasDeclaration[] 
}
```

See also: [DocBase](#class-docbase), [DocGenSupportApi](#interface-docgensupportapi)

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Class: DocVariable

```ts
export class DocVariable extends DocBase<ts.VariableDeclaration> {
    constructor(sup: DocGenSupportApi) 
    override getName(item: ts.VariableDeclaration, sf: ts.SourceFile): string 
    override filterItem(item: ts.Node): ts.VariableDeclaration[] 
}
```

See also: [DocBase](#class-docbase), [DocGenSupportApi](#interface-docgensupportapi)

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Class: TypescriptToMarkdown

Uses the Typescript compiler to parse source tree given a top level source file such as `index.ts`.

Extract the exported API interfaces, classes, types, functions and variables.

Generate GitHub friendly MarkDown documentation for the extracted API leveraging TypeScript type information
and merging JSDoc style documentation comments.

The following JSDoc tags are supported:

   `@example` Adds example as code block or comments and embedded code block(s).

   `@param` Adds comment for function or method parameter.

   `@private` Hides an otherwise accessible documentation item.

   `@privateinitializer` Hides property initializer from documentation typescript.

   `@property` Adds comment for class or interface property parameter in parent's JSDoc comment.

   `@publicbody` Overrides the normal hidding of method and function bodies.

   `@returns` Adds comment for function or method return value.

   `@throws` Adds thrown error comment to function or method.

```ts
export class TypescriptToMarkdown implements DocGenSupportApi {
    noDetailsSummary: boolean;
    filePath: string;
    fileName: string;
    markDown?: string;
    outputPath?: string;
    constructor(public options: Ts2MdOptions, public mdLinksEx?: Record<string, string>) 
    run(): {
        outputPath: string;
        mdLinks: Record<string, string>;
        mdLinksExternal: Record<string, string>;
    } 
}
```

See also: [DocGenSupportApi](#interface-docgensupportapi), [Ts2MdOptions](#interface-ts2mdoptions)

<details>

<summary>Class TypescriptToMarkdown Details</summary>

##### Constructor

Construct a new instance configured for `run` method to be called next.

```ts
constructor(public options: Ts2MdOptions, public mdLinksEx?: Record<string, string>) 
```
See also: [Ts2MdOptions](#interface-ts2mdoptions)

Argument Details

+ **options**
  + Must be provided. inputFilename defaults to `./src/index.ts`

##### Property fileName

The top level input Typescript file's filename without path

```ts
fileName: string
```

##### Property filePath

The top level input Typescript file's filename with full path.

```ts
filePath: string
```

##### Property markDown

The generated documentation as markdown string

```ts
markDown?: string
```

##### Property outputPath

The file path to which `markDown` was written.

```ts
outputPath?: string
```

##### Method run

Generates the documentation markdown and write's it to output file
and/or merges it to README.md

```ts
run(): {
    outputPath: string;
    mdLinks: Record<string, string>;
    mdLinksExternal: Record<string, string>;
} 
```

</details>

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
### Functions

| |
| --- |
| [mdMerge](#function-mdmerge) |
| [ts2md](#function-ts2md) |

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---

#### Function: mdMerge

Quick and dirty README.md merge function.

The anchors must not be indented and must exactly match:

   `<!--#region ts2md-api-merged-here-->`

   `<!--#endregion ts2md-api-merged-here-->`

```ts
export function mdMerge(md: string, mergePath: string, requireAnchors = true): void 
```

<details>

<summary>Function mdMerge Details</summary>

Argument Details

+ **md**
  + The markdown to insert between the start and end anchors.
+ **mergePath**
  + Fully resolved path to create or update.

</details>

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---
#### Function: ts2md

Generate Typescript documentation and merge into README.md

Attempts to validate options, constructs an instance of Ts2Md with those options, and runs the generation method.

1. Function argument is used if provided.

2. Looks for `./ts2md.json`

3. Default options.

Default options are:

```json
{
  "inputFilename": "./src/index.ts",
  "outputFilename": "./apiDoc.md",
  "firstHeadingLevel": 2,
  "noTitle": true,
  "outputReplace": true,
  "readmeMerge": true
}
```

4. Finally examines command line arguments which are treated as overrides of the options determined
by steps 1, 2, 3. Command line arguments can be provided as either:

```
--inputFilename ../index.ts
```

or

```
--inputFilename=../index.ts
```

```ts
export function ts2md(options?: Ts2MdOptions): void {
    if (!options) {
        try {
            const configPath = path.resolve("./ts2md.json");
            const json = fs.readFileSync(configPath, { encoding: "utf8" });
            options = <Ts2MdOptions>JSON.parse(json);
        }
        catch { }
    }
    if (!options?.options) {
        options ||= {
            inputFilename: "./src/index.ts",
            outputFilename: "",
            firstHeadingLevel: 2,
            noTitle: true,
            readmeMerge: true,
            noDetailsSummary: false
        };
        const args = process.argv;
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (!arg.startsWith("--"))
                continue;
            const e = arg.indexOf("=");
            let a = "", v = "";
            if (e > -1) {
                a = arg.slice(2, e);
                v = arg.slice(e + 1);
            }
            else {
                a = arg.slice(2);
                v = args[++i];
            }
            switch (a) {
                case "inputFilename":
                    options.inputFilename = v;
                    break;
                case "outputFilename":
                    options.outputFilename = v;
                    break;
                case "firstHeadingLevel":
                    options.firstHeadingLevel = <1 | 2 | 3>Number(v);
                    break;
                case "noTitle":
                    options.noTitle = (v === "true");
                    break;
                case "readmeMerge":
                    options.readmeMerge = (v === "true");
                    break;
                case "nothingPrivate":
                    options.nothingPrivate = (v === "true");
                    break;
                case "filenameSubString":
                    options.filenameSubString = v;
                    break;
                case "noDetailsSummary":
                    options.noDetailsSummary = (v === "true");
                    break;
                default: break;
            }
        }
        console.log("ts2md(", options, ")");
    }
    else {
        console.log("ts2md command line ignored.\nts2md(", options, ")");
    }
    if (options.options) {
        const mdLinksEx: Record<string, string> = {};
        for (const o of options.options) {
            const t = new TypescriptToMarkdown(o);
            const r = t.run();
            const base = path.parse(r.outputPath).base;
            for (const [key, mdLink] of Object.entries(r.mdLinks)) {
                if (!mdLinksEx[key]) {
                    mdLinksEx[key] = mdLink.replace("(#", `(./${base}#`);
                }
            }
        }
        for (const o of options.options) {
            const t = new TypescriptToMarkdown(o, mdLinksEx);
            t.run();
        }
    }
    else {
        new TypescriptToMarkdown(options).run();
    }
}
```

See also: [Ts2MdOptions](#interface-ts2mdoptions), [TypescriptToMarkdown](#class-typescripttomarkdown)

<details>

<summary>Function ts2md Details</summary>

Argument Details

+ **options**
  + Optional options to control markdown generation.

</details>

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes), [Functions](#functions)

---

<!--#endregion ts2md-api-merged-here-->

## License

The license for the code in this repository is the Open BSV License.
