/* eslint-disable @typescript-eslint/no-unused-vars */
import ts from "typescript";
import { EOL } from "os"

/** Regex to parse TypeScript tokens */
const tsTokenRegex = new RegExp(
    [
        '(?:\\/\\/.*|\\/\\*[\\s\\S]*?\\*\\/)', // Comments
        '("(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\')', // String literals
        '(\\b\\d+(\\.\\d+)?\\b)', // Numeric literals
        '(\\b(?:if|else|for|while|do|switch|case|break|continue|return|function|class|interface|enum|extends|implements|new|try|catch|finally|throw|void|public|protected|private|readonly|static|async|await|import|export|from|const|let|var|type|as|declare|default)\\b)', // Keywords
        '(\\b[A-Za-z_$][A-Za-z0-9_$]*\\b)', // Identifiers
        '([{}()\\[\\];,.:])', // Punctuation
        '([+\\-*/%&|^!?<>]=?|={1,3}|~|=>)' // Operators
    ].join('|'),
    'g'
);
    
/**
 * Parsed JSDoc info associated with a documentation item
 * 
 * @private
 */
export interface JSDocInfo {
    /**
     * true if has '@private' tag
     */
    isPrivate: boolean
    /**
     * true if has '@publicbody' tag
     */
    publicBody: boolean
    /**
     * true if has '@privateinitializer' tag
     */
    privateInitializer: boolean
    /**
     * JSDoc nodes with ['comment'] strings not otherwise tagged with a recognized tag.
     */
    comments: string[]
    /**
     * The @param tag comments.
     */
    params: ts.JSDocParameterTag[]
    /**
     * JSDoc nodes tagged with '@returns'
     */
    returns: ts.JSDocReturnTag[]
    /**
     * JSDoc nodes tagged with '@throws'
     */
    throws: ts.JSDocThrowsTag[]
    /**
     * The @example tag comments. Comments without code blocks are assumed to be typescript codeblocks
     */
    examples: string[]
    /**
     * The @property tag identifiers and comments. These are forwarded to the relevant member property documentation.
     */
    properties: Record<string, string>
    /**
     * JSDoc tags not parsed into other properties
     */
    tags: ts.Node[]
    /**
     * JSDoc nodes not parsed into other properties
     */
    other: ts.Node[]    
}

/**
 * Parse available JSDoc information on this node.
 * 
 * @private
 */
export function getJsDocInfo(node: ts.Node, name: string, parent?: DocItem<ts.Node>) : JSDocInfo {
    const r: JSDocInfo = {
        isPrivate: false,
        comments: [],
        params: [],
        returns: [],
        throws: [],
        examples: [],
        tags: [],
        other: [],
        publicBody: false,
        privateInitializer: false,
        properties: {}
    }

    if (name !== 'constructor' && parent && parent.jsDoc.properties[name])
        // Forward @property tags on the parent to this node by name
        r.comments.push(parent.jsDoc.properties[name])

    const jsDoc: ts.Node[] = (node['jsDoc']) ? node['jsDoc'] as ts.Node[] : []

    for (const doc of jsDoc) {

        const comment = doc['comment']
        if (comment && typeof comment === 'string')
            r.comments.push(comment)

        for (const t of (doc['tags'] ? doc['tags'] as ts.Node[] : [])) {
            const comment = typeof t['comment'] === 'string' ? t['comment'] : undefined
            if (t.kind === ts.SyntaxKind.JSDocParameterTag) {
                if (comment)
                    r.params.push(t as ts.JSDocParameterTag)
            } else if (t.kind === ts.SyntaxKind.JSDocReturnTag) {
                if (comment)
                    r.returns.push(t as ts.JSDocReturnTag)
            } else if (t.kind === ts.SyntaxKind.JSDocThrowsTag) {
                if (comment)
                    r.throws.push(t as ts.JSDocThrowsTag)
            } else {
                const tag = t.kind === ts.SyntaxKind.JSDocTag ? (t as ts.JSDocTag).tagName.escapedText : ''
                if (tag === 'publicbody') {
                    r.publicBody = true
                }
                else if (tag === 'privateinitializer') {
                    r.privateInitializer = true
                }
                else if (tag === 'property') {
                    if (comment) {
                        const re = /(?<identifier>[^ \t\-:]+)[ \t\-:]+(?<comment>.*)/
                        const m = comment.match(re)
                        if (m && m.index === 0 && m.groups) {
                            r.properties[m.groups.identifier] = m.groups.comment
                        }
                    }
                }
                else if (tag === 'example') {
                    if (comment) {
                        let example: string = comment
                        if (example.indexOf('```') === -1)
                            example = '```ts' + EOL + example + EOL + '```' + EOL
                        r.examples.push(example)
                    }
                }
                else
                    r.tags.push(t)
            }
        }
    }
    return r
}

/**
 * Wrapper for a Typescript `Node` of a specific derived type,
 * which is of interest for documentation generation.
 * 
 * @private
 */
export class DocItem<T extends ts.Node> {
    /**
     * Parsed JSDoc information for this item
     */
    jsDoc: JSDocInfo

    /**
     * Subsidiary documentation nodes when the node has members which
     * are themselves represented as documentation nodes.
     */
    memberDocs: DocBase<ts.Node>[] = []

    /**
     * This is really here just for demonstration / testing purposes...
     * @param item The typescript Node for this doc item.
     * @param name The name for this doc item.
     * @param sf The source file which defined this item.
     */
    constructor(public item: T, public name: string, public sf: ts.SourceFile, public parent?: DocItem<ts.Node>) {
        this.jsDoc = getJsDocInfo(item, name, parent)
    }
}

/**
 * @private
 */
export interface DocGenSupportApi {
    printer: ts.Printer
    nothingPrivate: boolean
    noDetailsSummary: boolean
    headingLevelMd(relativeLevel: number) : string
}

/**
 * @private
 */
export abstract class DocBase<T extends ts.Node> {
    docItems: DocItem<T>[] = []

    constructor(public sup: DocGenSupportApi, public label: string, public labelPlural: string, public detailsLabel = 'Details') {
    }
    
    abstract getName(item: T, sf: ts.SourceFile) : string

    abstract filterItem(s: ts.Node) : T[]

    tryAddItem(s: ts.Node, sf: ts.SourceFile, parent?: DocItem<ts.Node>) {
        const items = this.filterItem(s)
        
        for (const item of items) {
            const docItem = new DocItem(item, this.getName(item, sf), sf, parent)
            if (!docItem.jsDoc.isPrivate || this.sup.nothingPrivate) {
                docItem.memberDocs = this.extractMemberDocs(docItem)
                for (const md of docItem.memberDocs) {
                    md.docItems.sort((a, b) => a.name < b.name ? -1 : a.name === b.name ? 0 : 1)
                }
                this.docItems.push(docItem)
            }
        }
    }

    extractMemberDocs(docItem: DocItem<ts.Node>) : DocBase<ts.Node>[] { return [] }
    
    isNotPrivate(item: ts.Node) : boolean {
        // not private if either we don't care if its private
        const notPrivate = (this.sup.nothingPrivate ||
             // Or it isn't private, which is either by having the private keyword
             !((item['modifiers'] && item['modifiers'].some(m => m.kind === ts.SyntaxKind.PrivateKeyword)) ||
               // or by having private jsdoc tag
               item['jsDoc']?.some(t => ts.isJSDocPrivateTag(t)) ||
               item['jsDoc']?.some(t => t['tags']?.some(r => ts.isJSDocPrivateTag(r)))
               ))
        return notPrivate
    }

    findTs(findInTs: string, targetTs: string) : { pos: number, len: number } {
        let pos = findInTs.indexOf(targetTs)
        if (pos === -1) {
            // Try outdenting once
            const regex1 = EOL === '\n' ? /\n/g : /\r\n/g
            targetTs = targetTs.replace(regex1, EOL + '    ',)
            pos = findInTs.indexOf(targetTs)
            if (pos === -1) {
                // set and get accessor bodies sometimes are inlined in full generated class typescript
                // remove all indenting
                const regex2 = EOL === '\n' ? /\n */g : /\r\n */g
                targetTs = targetTs.replace(regex2, ' ')
                pos = findInTs.indexOf(targetTs)
            }
        }
        return { pos, len: targetTs.length }
    }

    removeTs(fromTs: string, removeTs: string, withSemi?: boolean) : string {
        const r = this.findTs(fromTs, removeTs)
        // See if we would leave a dangling semicolon behind
        if (r.pos > -1 && withSemi && r.pos + r.len + EOL.length < fromTs.length && fromTs[r.pos + r.len] === ';' && fromTs.slice(r.pos + r.len + 1, r.pos + r.len + 1 + EOL.length) === EOL) {
            r.len += 1 + EOL.length
            // and remove leading spaces
            while (r.pos > 0 && fromTs[r.pos - 1] === ' ') { r.pos--; r.len++ }
        }
        if (r.pos > -1) {
            fromTs = fromTs.slice(0, r.pos) + fromTs.slice(r.pos + r.len)
            // If EOL follows what we removed...
            if (fromTs.slice(r.pos, r.pos + EOL.length) === EOL) {
                let pos2 = r.pos -1
                while (pos2 > 0 && fromTs[pos2] === ' ') pos2--
                if (fromTs.slice(pos2 + 1 - EOL.length, pos2 + 1) === EOL) {
                    // and remove blank line left after original removal
                    fromTs = fromTs.slice(0, pos2 + 1 - EOL.length) + fromTs.slice(r.pos)
                }
            }
        }
        return fromTs
    }

    toSeeAlso(docItem: DocItem<T>, mdts: string, mdLinks: Record<string, string>, tight?: boolean): string {
        const mdtsLinks: string[] = []
        const tokens = Array.from(mdts.matchAll(tsTokenRegex)).map(t => t[0]);
        const linkTokens = Object.keys(mdLinks).sort((a, b) => a < b ? -1 : a === b ? 0 : 1)
        for (const token of linkTokens) {
            if (token !== docItem.name && tokens.indexOf(token) > -1) {
                mdtsLinks.push(mdLinks[token])
            }
        }
        let md = tight ? '' : EOL
        if (mdtsLinks.length === 0)
            return md
        md += 'See also: ' + mdtsLinks.join(', ') + EOL
        if (!tight) md += EOL
        return md
    }

    toTsMarkDown(docItem: DocItem<T>, mdLinks: Record<string, string>, tight?: boolean): string {
        const mdts = this.toMarkDownTs(docItem)
        if (!mdts)
            return ''
        return '```ts' + EOL + mdts + EOL + '```' + EOL + this.toSeeAlso(docItem, mdts, mdLinks, tight)
    }

    /**
     * Base class implementation of markdown generation for a top level typescript AST node (`DocItem`).
     * 
     * Adds relative level 3 heading with `label` and `docItem.name`
     * 
     * Adds the nodes simple (no `@` tag) JSDoc nodes under relative level 4 'Description` heading
     * 
     * Calls the `toMarkDownTs` override to add the typescript syntax code block for this node.
     * 
     * Calls the `toMarkDownDtails` override to add any details markdown for this node.
     * 
     * @returns the generated markdown for this `DocItem`
     */
    toMarkDown(docItem: DocItem<T>, mdLinks: Record<string, string>): string {
        let md = `${this.sup.headingLevelMd(3)} ${this.label}: ${docItem.name}` + EOL + EOL

        md += this.commentsDetails(docItem)

        md += this.examplesDetails(docItem)

        md += this.toTsMarkDown(docItem, mdLinks)

        const details = this.toMarkDownDetails(docItem, mdLinks)
        if (details) {
            if (this.sup.noDetailsSummary) {
                md += details
            } else {
                md += `<details>${EOL}${EOL}<summary>${this.label} ${docItem.name} ${this.detailsLabel}</summary>` + EOL + EOL
                md += details
                md += `</details>` + EOL + EOL
            }
        }

        return md
    }

    /**
     * Generate the typescript syntax for this node to be inserted in a typescript syntax code block
     * in generated markdown.
     * 
     * Base class implementation uses the typescript compiler printer on `DocItem` AST node `item`.
     * 
     * CAUTION: This adds ALL the source code for this item to the generated markdown. Override SHOULD
     * implement appropriate ommission control policies.
     * 
     * @returns typescript syntax to be added within a typescript syntax code block for this `DocItem`
     */
    toMarkDownTs(docItem: DocItem<T>) : string {
        let item = docItem.item
        if (item['initializer'] && docItem.jsDoc.privateInitializer) {
            item = { ...item }
            item['initializer'] = undefined
        }
        const mdts = this.sup.printer.printNode(ts.EmitHint.Unspecified, item, docItem.sf)
        return mdts
    }

    /**
     * Generate the 'Details' markdown (including ) for this node.
     * 
     * Base class implementation returns an empty string.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    toMarkDownDetails(docItem: DocItem<T>, mdLinks: Record<string, string>) : string {
        return ''
    }

    toMarkDownRefLink(docItem: DocItem<T>) : string {
       return `[${docItem.name}](#${this.label.toLowerCase()}-${docItem.name.toLowerCase()})`
    }

    isExportedDeclaration(item: ts.Declaration) : boolean {
        const modFlags = ts.getCombinedModifierFlags(item)
        const hasExportFlag = !!(modFlags & ts.ModifierFlags.Export)
        return hasExportFlag
    }

    argumentsDetails(docItem: DocItem<T>) : string {
        let md = ''
        if (docItem.jsDoc.params.length > 0) {
            md += `Argument Details` + EOL + EOL
            for (const tag of docItem.jsDoc.params) {
                const name = tag.name.getText(docItem.sf)
                let comment = tag.comment
                if (typeof comment === 'string') {
                    if (comment?.indexOf('- ') === 0)
                        // remove leading '- ' if present
                        comment = comment.slice(2)
                    md += `+ **${name}**${EOL}  + ${comment}${EOL}`
                }
            }
            md += EOL + ''
        }
        return md
    }

    returnsDetails(docItem: DocItem<T>) : string {
        let md = ''
        if (docItem.jsDoc.returns.length > 0) {
            md += `Returns` + EOL + EOL
            for (const t of docItem.jsDoc.returns) {
                md += `${t.comment}` + EOL + EOL
            }
        }
        return md
    }

    throwsDetails(docItem: DocItem<T>) : string {
        let md = ''
        if (docItem.jsDoc.throws.length > 0) {
            md += `Throws` + EOL + EOL
            for (const tag of docItem.jsDoc.throws) {
                md += `${tag.comment}` + EOL + EOL
            }
        }
        return md
    }

    examplesDetails(docItem: DocItem<T>) : string {
        let md = ''
        if (docItem.jsDoc.examples.length > 0) {
            md += `Example${docItem.jsDoc.examples.length > 1 ? 's' : ''}` + EOL + EOL
            for (const e of docItem.jsDoc.examples) {
                md += `${e}${EOL}`
            }
        }
        return md
    }

    commentsDetails(docItem: DocItem<T>) : string {
        let md = ''
        for (const comment of docItem.jsDoc.comments) {
            md += `${comment}` + EOL + EOL
        }
        return md
    }
}
