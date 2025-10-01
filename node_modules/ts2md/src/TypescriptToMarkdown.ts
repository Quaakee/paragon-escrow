import { EOL } from "os"
import * as path from "path";
import ts from "typescript";
import { mdMerge } from "./mdMerge";
import { Ts2MdOptions } from "./Ts2MdOptions";
import { DocBase, DocGenSupportApi, DocItem } from "./JSDocs";
import { DocClass, DocEnum, DocFunction, DocInterface, DocType, DocVariable } from "./Docs";

/**
 * Uses the Typescript compiler to parse source tree given a top level source file such as `index.ts`.
 *
 * Extract the exported API interfaces, classes, types, functions and variables.
 *
 * Generate GitHub friendly MarkDown documentation for the extracted API leveraging TypeScript type information
 * and merging JSDoc style documentation comments.
 *
 * The following JSDoc tags are supported:
 *
 *    `@example` Adds example as code block or comments and embedded code block(s).
 *
 *    `@param` Adds comment for function or method parameter.
 *
 *    `@private` Hides an otherwise accessible documentation item.
 *
 *    `@privateinitializer` Hides property initializer from documentation typescript.
 *
 *    `@property` Adds comment for class or interface property parameter in parent's JSDoc comment.
 *
 *    `@publicbody` Overrides the normal hidding of method and function bodies.
 *
 *    `@returns` Adds comment for function or method return value.
 *
 *    `@throws` Adds thrown error comment to function or method.
 */
export class TypescriptToMarkdown implements DocGenSupportApi {

    private program: ts.Program;

    /**
     * @private
     */
    printer: ts.Printer;
    private sourceFiles: ts.SourceFile[] = [];
    private docs: DocBase<ts.Node>[] = [];

    /**
     * For each symbol name, the markdown link which will exist in this document.
     */
    private mdLinks: Record<string, string> = {}
    /**
     * mdLinks that are not defined in the current outputPath
     */
    private mdLinksExternal: Record<string, string> = {}

    noDetailsSummary: boolean;

    /**
     * @private
     */
    nothingPrivate: boolean;

    /**
     * The top level input Typescript file's filename with full path.
     */
    filePath: string;
    /**
     * The top level input Typescript file's filename without path
     */
    fileName: string;
    /**
     * The generated documentation as markdown string
     */
    markDown?: string;
    /**
     * The file path to which `markDown` was written.
     */
    outputPath?: string;

    /**
     * Construct a new instance configured for `run` method to be called next.
     *
     * @param options Must be provided. inputFilename defaults to `./src/index.ts`
     */
    constructor(public options: Ts2MdOptions, public mdLinksEx?: Record<string, string>) {
        
        options.inputFilename ||= './src/index.ts';
        this.nothingPrivate = options.nothingPrivate || false;
        this.noDetailsSummary = options.noDetailsSummary || false;

        this.filePath = path.resolve(options.inputFilename);
        this.fileName = path.parse(this.filePath).name;

        const compOpts: ts.CompilerOptions = {
            allowJs: false,
            target: ts.ScriptTarget.Latest
        };
        const progOpts: ts.CreateProgramOptions = {
            rootNames: [this.filePath],
            options: compOpts
        };

        this.program = ts.createProgram(progOpts);

        const printOpts: ts.PrinterOptions = {
            newLine: EOL === '\n' ? ts.NewLineKind.LineFeed : ts.NewLineKind.CarriageReturnLineFeed,
            removeComments: true,
            omitTrailingSemicolon: true
        };

        const printHandlers: ts.PrintHandlers = {};

        this.printer = ts.createPrinter(printOpts, printHandlers);

    }

    /**
     * Generates the documentation markdown and write's it to output file
     * and/or merges it to README.md
     */
    run(): { outputPath: string, mdLinks: Record<string, string>, mdLinksExternal: Record<string, string> } {
        this.outputPath = path.resolve(this.options.outputFilename || './README.md')
        const requireAnchors = !this.options.outputFilename
        this.sourceFiles = this.parseSourceFiles(this.program);
        this.docs = this.extractDocs(this.sourceFiles);
        this.markDown = this.generateMarkDown(this.docs);
        if (this.markDown) {
            mdMerge(this.markDown, this.outputPath, requireAnchors)
        }
        return {
            outputPath: this.outputPath,
            mdLinks: this.mdLinks,
            mdLinksExternal: this.mdLinksExternal
        }
    }

    /**
     * @private
     */
    headingLevelMd(relativeLevel: number): string {
        relativeLevel += this.options.firstHeadingLevel - 1;
        if (this.options.noTitle) relativeLevel--;
        return '#'.repeat(relativeLevel + this.options.firstHeadingLevel - 1);
    }

    private parseSourceFiles(program: ts.Program): ts.SourceFile[] {
        return program.getSourceFiles().filter(sf => sf.fileName.indexOf('node_modules') === -1);
    }

    private extractDocs(sourceFiles: ts.SourceFile[]): DocBase<ts.Node>[] {
        let docs: DocBase<ts.Node>[] = [
            new DocInterface(this),
            new DocClass(this),
            new DocFunction(this),
            new DocType(this),
            new DocEnum(this),
            new DocVariable(this)
        ];

        for (const sf of sourceFiles) {
            //console.log(`SourceFile ${sf.fileName}`);
            ts.forEachChild(sf, node => {
                if (ts.isStatement(node)) {
                    for (const doc of docs) {
                        doc.tryAddItem(node, sf);
                    }
                }
            });
        }

        // Eliminate empty doc categories
        docs = docs.filter(d => d.docItems.length > 0);
        return docs;
    }

    private generateMarkDown(docs: DocBase<ts.Node>[]): string {
        let md = '';
        this.mdLinks = {}
        this.mdLinksExternal = {}

        const contributesToOutput = (docItem: DocItem<ts.Node>): boolean => {
            if (!this.options.filenameSubString)
                return true
            const fn = docItem.sf.fileName
            const add = fn.indexOf(this.options.filenameSubString || '') > -1
            return add
        }

        // Sort docItems by name
        for (const doc of docs) {
            doc.docItems = doc.docItems.sort((a, b) => {
                return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
            })
        }

        for (const doc of this.docs) {
            const filteredItems: DocItem<ts.Node>[] = []
            for (const docItem of doc.docItems) {
                const linkMd = doc.toMarkDownRefLink(docItem)
                if (contributesToOutput(docItem)) {
                    this.mdLinks[docItem.name] = linkMd
                    filteredItems.push(docItem)
                    //console.log(`Adding ${fn} ${docItem.name}`)
                } else {
                    if (!this.mdLinksExternal[docItem.name])
                        this.mdLinksExternal[docItem.name] = linkMd
                }
            }
            doc.docItems = filteredItems
        }

        if (this.mdLinksEx)
            this.mdLinks = this.mdLinksEx

        if (!this.options.noTitle) {
            md += `${this.headingLevelMd(1)} API${EOL}${EOL}`;
        } else {
            md += EOL;
        }

        let linksMd = `Links: [API](#api)`;
        for (const doc of docs) {
            linksMd += `, [${doc.labelPlural}](#${doc.labelPlural.toLowerCase()})`;
        }
        linksMd += EOL + EOL;

        md += linksMd;

        for (const doc of this.docs) {

            md += `${this.headingLevelMd(2)} ${doc.labelPlural}` + EOL + EOL;

            if (doc.docItems.length > 1) {
                md += this.generateDocItemLinksTable(doc);
                md += EOL + `${linksMd}---` + EOL + EOL;
            }

            for (const docItem of doc.docItems) {
                md += doc.toMarkDown(docItem, this.mdLinks);
                md += linksMd;
                md += '---' + EOL;
            }
        }

        return md;
    }

    /**
     * Generates a markdown table of named links to docItem documentation headers.
     * @param doc The category of documentation for which to generate the table.
     * @returns markdown table of named links to docItem documentation headers
     */
    private generateDocItemLinksTable(doc: DocBase<ts.Node>): string {
        let md = '';

        const nameLinks = doc.docItems.map(d => ({ name: d.name, linkMd: doc.toMarkDownRefLink(d) }));
        nameLinks.sort((a, b) => a.name < b.name ? -1 : a.name === b.name ? 0 : 1);

        let cols = 1, rows = nameLinks.length;
        while (cols < 3 && rows > 12) { cols++; rows = Math.ceil(nameLinks.length / cols); }

        for (let col = 1; col <= cols; col++) { md += '| '; } md += '|' + EOL;

        for (let col = 1; col <= cols; col++) { md += '| --- '; } md += '|' + EOL;

        for (let row = 1; row <= rows; row++) {
            for (let col = 1; col <= cols; col++) {
                const i = (col - 1) * rows + row - 1;
                const d = i < nameLinks.length ? nameLinks[i].linkMd : '';
                if (col === 1) md += '|';
                md += ` ${d} |`;
            }
            md += EOL + '';
        }
        return md;
    }
}
