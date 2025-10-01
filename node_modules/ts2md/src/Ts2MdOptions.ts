/**
 * Options for the `Ts2Md` class which generates Typescript documentation.
 */
export interface Ts2MdOptions {
    options?: Ts2MdOptions[]
    /**
     * Primary typescript source file, default is `./src/index.ts`
     */
    inputFilename: string;
    /**
     * The heading level for the first generated heading.
     */
    firstHeadingLevel: 1 | 2 | 3;
    /**
     * Set to true if generated markdown will be merged into
     * a file that already includes a containing header.
     */
    noTitle: boolean;
    /**
     * If valid, a copy of the generated markdown documentation will be
     * saved to this file.
     */
    outputFilename?: string;
    /**
     * Set to true if the generated output should be merged into README.md
     *
     * Currently README.md must exist at `./README.md`
     *
     * and must contain the following merge start and merge end anchors:
     *
     *    `<!--#region ts2md-api-merged-here-->`
     *
     *    `<!--#endregion ts2md-api-merged-here-->`
     *
     * The anchors must not be indented.
     */
    readmeMerge: boolean;
    /**
     * If true, overrides private typescript keywords and jsdoc tags.
     *
     * CAUTION: This setting is inappropriate for published documentation ;-)
     */
    nothingPrivate?: boolean;
    /**
     * If specified, only symbols defined in files with this value as a substring
     * are included in generated markdown.
     * 
     * '/' must be used as the folder separator.
     */
    filenameSubString?: string
    /**
     * GitHub Pages, and other consumers of markdown, may not support the
     * <details> and <summary> tags embedded in markdown.
     * 
     * Set `noDetailsSummary` to true to skip wrapping details with this tag.
     */
    noDetailsSummary?: boolean
}
