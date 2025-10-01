/* eslint-disable @typescript-eslint/no-unused-vars */
import { DocBase, DocGenSupportApi, DocItem, getJsDocInfo } from "./JSDocs"
import ts from "typescript";
import { EOL } from "os"
import { doc } from "prettier";

/**
 * @private
 */
export class DocVariable extends DocBase<ts.VariableDeclaration> {
    constructor(sup: DocGenSupportApi) { super(sup, 'Variable', 'Variables') }

    override getName(item: ts.VariableDeclaration, sf: ts.SourceFile): string {
        return item.name.getText(sf)
    }

    override filterItem(item: ts.Node): ts.VariableDeclaration[] {
        const items: ts.VariableDeclaration[] = []
        if (ts.isVariableStatement(item) && item.modifiers &&
            (this.sup.nothingPrivate || item.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword))) {
            for (const v of item.declarationList.declarations) {
                items.push(v)
            }
        }
        return items
    }
}

/**
 * @private
 */
export class DocType extends DocBase<ts.TypeAliasDeclaration> {
    constructor(sup: DocGenSupportApi) { super(sup, 'Type', 'Types') }

    override getName(item: ts.TypeAliasDeclaration): string {
        return item.name.text
    }

    override filterItem(item: ts.Node): ts.TypeAliasDeclaration[] {
        if (ts.isTypeAliasDeclaration(item) &&
            (this.sup.nothingPrivate || this.isExportedDeclaration(item)))
            return [item]
        return []
    }
}

/**
 * @private
 */
export class DocFunction extends DocBase<ts.FunctionDeclaration> {
    constructor(sup: DocGenSupportApi) { super(sup, 'Function', 'Functions', 'Details') }

    override getName(item: ts.FunctionDeclaration): string {
        return item.name?.text || ''
    }

    override filterItem(item: ts.Node): ts.FunctionDeclaration[] {
        if (ts.isFunctionDeclaration(item) && this.isNotPrivate(item) &&
            (this.sup.nothingPrivate || this.isExportedDeclaration(item))) {
            return [item]
        }
        return []
    }

    override toMarkDownTs(docItem: DocItem<ts.FunctionDeclaration>) : string {
        const n = docItem.item
        const sf = docItem.sf
        const printer = this.sup.printer
        
        let mdts = printer.printNode(ts.EmitHint.Unspecified, n, sf)
        if (n.body && !docItem.jsDoc.publicBody) {
            // Remove the function body
            const bodyts  = printer.printNode(ts.EmitHint.Unspecified, n.body, sf)
            mdts = this.removeTs(mdts, bodyts)
        }
        return mdts
    }

    override toMarkDownDetails(docItem: DocItem<ts.FunctionDeclaration>, mdLinks: Record<string, string>) : string {
        let md = ''

        md += this.returnsDetails(docItem)
        
        md += this.argumentsDetails(docItem)

        md += this.throwsDetails(docItem)

        return md
    }
}

/**
 * @private
 */
export class DocProperty extends DocBase<ts.PropertyDeclaration> {
    constructor(sup: DocGenSupportApi) { super(sup, 'Property', 'Properties') }

    override getName(item: ts.PropertyDeclaration): string {
        if (ts.isIdentifier(item.name))
            return item.name.text
        return ''
    }

    override filterItem(item: ts.Node): ts.PropertyDeclaration[] {
        if (ts.isPropertyDeclaration(item) && this.isNotPrivate(item))
            return [item]
        return []
    }

    override toMarkDownDetails(docItem: DocItem<ts.PropertyDeclaration>, mdLinks: Record<string, string>) : string {
        let md = ''

        md += this.examplesDetails(docItem)

        const comments = this.commentsDetails(docItem)

        if (md || comments) {
            const mdts = this.toTsMarkDown(docItem, mdLinks, true)
            let intro = `${this.sup.headingLevelMd(4)} Property ${docItem.name}${EOL}${EOL}`
            if (comments) intro += comments
            md = `${intro}${mdts}${EOL}${md}`
        }

        return md
    }
}

/**
 * @private
 */
export class DocConstructor extends DocBase<ts.ConstructorDeclaration> {
    constructor(sup: DocGenSupportApi) { super(sup, 'Constructor', 'Constructors', 'Arguments') }

    override getName(item: ts.ConstructorDeclaration): string {
        return 'constructor'
    }

    override filterItem(item: ts.Node): ts.ConstructorDeclaration[] {
        if (ts.isConstructorDeclaration(item) && this.isNotPrivate(item))
            return [item]
        return []
    }

    override toMarkDownTs(docItem: DocItem<ts.ConstructorDeclaration>) : string {
        const n = docItem.item
        const sf = docItem.sf
        const printer = this.sup.printer
        let mdts = printer.printNode(ts.EmitHint.Unspecified, n, sf)

        if (n['body'] && !(this.sup.nothingPrivate || docItem.jsDoc.publicBody)) {
            // Remove the body from documentation typescript
            const bodyts  = printer.printNode(ts.EmitHint.Unspecified, n['body'], sf)
            mdts = this.removeTs(mdts, bodyts)
        }
        return mdts
    }

    override toMarkDownDetails(docItem: DocItem<ts.ConstructorDeclaration>, mdLinks: Record<string, string>) : string {
        let md = ''

        md += this.argumentsDetails(docItem)

        md += this.throwsDetails(docItem)

        md += this.examplesDetails(docItem)

        const comments = this.commentsDetails(docItem)

        if (md || comments) {
            const mdts = this.toTsMarkDown(docItem, mdLinks, true)
            let intro = `${this.sup.headingLevelMd(4)} Constructor${EOL}${EOL}`
            if (comments) intro += comments
            md = `${intro}${mdts}${EOL}${md}`
        }

        return md
    }
}

/**
 * @private
 */
export class DocMethod extends DocBase<ts.MethodDeclaration> {
    constructor(sup: DocGenSupportApi) { super(sup, 'Method', 'Methods') }

    override getName(item: ts.MethodDeclaration): string {
        if (ts.isIdentifier(item.name))
            return item.name.text
        return ''
    }

    override filterItem(item: ts.Node): ts.MethodDeclaration[] {
        if (ts.isMethodDeclaration(item) && this.isNotPrivate(item))
            return [item]
        return []
    }

    override toMarkDownTs(docItem: DocItem<ts.MethodDeclaration>) : string {
        const n = docItem.item
        const sf = docItem.sf
        const printer = this.sup.printer
        let mdts = printer.printNode(ts.EmitHint.Unspecified, n, sf)

        if (n['body'] && !(this.sup.nothingPrivate || docItem.jsDoc.publicBody)) {
            // Remove the body from documentation typescript
            const bodyts  = printer.printNode(ts.EmitHint.Unspecified, n['body'], sf)
            mdts = this.removeTs(mdts, bodyts)
        }
        return mdts
    }

    override toMarkDownDetails(docItem: DocItem<ts.MethodDeclaration>, mdLinks: Record<string, string>) : string {
        let md = ''

        md += this.returnsDetails(docItem)

        md += this.argumentsDetails(docItem)

        md += this.throwsDetails(docItem)

        md += this.examplesDetails(docItem)

        const comments = this.commentsDetails(docItem)

        if (md || comments) {
            const mdts = this.toTsMarkDown(docItem, mdLinks, true)
            let intro = `${this.sup.headingLevelMd(4)} Method ${docItem.name}${EOL}${EOL}`
            if (comments) intro += comments
            md = `${intro}${mdts}${EOL}${md}`
        }

        return md
    }
}

/**
 * @private
 */
export class DocClass extends DocBase<ts.ClassDeclaration> {
    constructor(sup: DocGenSupportApi) { super(sup, 'Class', 'Classes') }

    override getName(item: ts.ClassDeclaration): string {
        return item.name?.text || ''
    }

    override filterItem(item: ts.Node): ts.ClassDeclaration[] {
        if (ts.isClassDeclaration(item) && 
            (this.sup.nothingPrivate || this.isExportedDeclaration(item)))
            return [item]
        return []
    }

    override extractMemberDocs(docItem: DocItem<ts.ClassDeclaration>) : DocBase<ts.Node>[] {
        const n = docItem.item
        const sf = docItem.sf

        let docs: DocBase<ts.Node>[] = [
            new DocConstructor(this.sup),
            new DocProperty(this.sup),
            new DocMethod(this.sup),
        ]

        for (const ce of n.members) {
            for (const doc of docs) {
                doc.tryAddItem(ce, sf, docItem)
            }
        }
        
        // Eliminate empty doc categories
        docs = docs.filter(d => d.docItems.length > 0)
        return docs
    }
    
    override toMarkDownTs(docItem: DocItem<ts.ClassDeclaration>) : string {
        const n = docItem.item
        const sf = docItem.sf
        const printer = this.sup.printer

        // class definition typescript including all members and function bodies...
        let mdts = printer.printNode(ts.EmitHint.Unspecified, n, sf)
        for (const ce of n.members) {
            const r = getJsDocInfo(ce, docItem.name)
            let isPrivate = false
            if (!this.sup.nothingPrivate &&
                ((ce['modifiers'] && ce['modifiers'].some(m => m.kind === ts.SyntaxKind.PrivateKeyword)) ||
                r.tags.some(t => ts.isJSDocPrivateTag(t)))) {
                isPrivate = true
                // Remove entire member
                const memberts = printer.printNode(ts.EmitHint.Unspecified, ce, sf)
                mdts = this.removeTs(mdts, memberts, true)
            } else if (ce['body'] && !r.publicBody) {
                // Remove the body from documentation typescript
                const bodyts  = printer.printNode(ts.EmitHint.Unspecified, ce['body'], sf)
                mdts = this.removeTs(mdts, bodyts)
            } else if (ce['initializer'] && r.privateInitializer) {
                const initializerts  = printer.printNode(ts.EmitHint.Unspecified, ce['initializer'], sf)
                mdts = this.removeTs(mdts, `= ${initializerts};`)
            }
        }
        return mdts
    }

    override toMarkDownDetails(docItem: DocItem<ts.ClassDeclaration>, mdLinks: Record<string, string>): string {
        let md = ''

        for (const doc of docItem.memberDocs) {
            for (const item of doc.docItems) {
                const details = doc.toMarkDownDetails(item, mdLinks)
                if (details)
                    md += details
            }
        }

        return md
    }
}

/**
 * @private
 */
export class DocPropertySignature extends DocBase<ts.PropertySignature> {
    constructor(sup: DocGenSupportApi) { super(sup, 'Property', 'Properties') }

    override getName(item: ts.PropertySignature): string {
        if (ts.isIdentifier(item.name))
            return item.name.text
        return ''
    }

    override filterItem(item: ts.Node): ts.PropertySignature[] {
        if (ts.isPropertySignature(item) && this.isNotPrivate(item))
            return [item]
        return []
    }

    override toMarkDownDetails(docItem: DocItem<ts.PropertySignature>, mdLinks: Record<string, string>) : string {
        let md = ''

        md += this.examplesDetails(docItem)

        const comments = this.commentsDetails(docItem)

        if (md || comments) {
            const mdts = this.toTsMarkDown(docItem, mdLinks, true)
            let intro = `${this.sup.headingLevelMd(4)} Property ${docItem.name}${EOL}${EOL}`
            if (comments) intro += comments
            md = `${intro}${mdts}${EOL}${md}`
        }

        return md
    }
}

/**
 * @private
 */
export class DocMethodSignature extends DocBase<ts.MethodSignature> {
    constructor(sup: DocGenSupportApi) { super(sup, 'Method', 'Methods') }

    override getName(item: ts.MethodSignature): string {
        if (ts.isIdentifier(item.name))
            return item.name.text
        return ''
    }

    override filterItem(item: ts.Node): ts.MethodSignature[] {
        if (ts.isMethodSignature(item) && this.isNotPrivate(item))
            return [item]
        return []
    }

    override toMarkDownTs(docItem: DocItem<ts.MethodSignature>) : string {
        const n = docItem.item
        const sf = docItem.sf
        const printer = this.sup.printer
        let mdts = printer.printNode(ts.EmitHint.Unspecified, n, sf)

        if (n['body'] && !(this.sup.nothingPrivate || docItem.jsDoc.publicBody)) {
            // Remove the body from documentation typescript
            const bodyts  = printer.printNode(ts.EmitHint.Unspecified, n['body'], sf)
            mdts = this.removeTs(mdts, bodyts)
        }
        return mdts
    }

    override toMarkDownDetails(docItem: DocItem<ts.MethodSignature>, mdLinks: Record<string, string>) : string {
        let md = ''

        md += this.returnsDetails(docItem)

        md += this.argumentsDetails(docItem)

        md += this.throwsDetails(docItem)

        md += this.examplesDetails(docItem)

        const comments = this.commentsDetails(docItem)

        if (md || comments) {
            const mdts = this.toTsMarkDown(docItem, mdLinks, true)
            let intro = `${this.sup.headingLevelMd(4)} Method ${docItem.name}${EOL}${EOL}`
            if (comments) intro += comments
            md = `${intro}${mdts}${EOL}${md}`
        }

        return md
    }
}

/**
 * @private
 */
export class DocInterface extends DocBase<ts.InterfaceDeclaration> {
    constructor(sup: DocGenSupportApi) { super(sup, 'Interface', 'Interfaces') }

    override getName(item: ts.InterfaceDeclaration): string {
        return item.name.text
    }

    override filterItem(item: ts.Node): ts.InterfaceDeclaration[] {
        if (ts.isInterfaceDeclaration(item) &&
            (this.sup.nothingPrivate || this.isExportedDeclaration(item)))
            return [item]
        return []
    }

    override extractMemberDocs(docItem: DocItem<ts.InterfaceDeclaration>) : DocBase<ts.Node>[] {
        const n = docItem.item
        const sf = docItem.sf

        let docs: DocBase<ts.Node>[] = [
            new DocPropertySignature(this.sup),
            new DocMethodSignature(this.sup),
        ]

        for (const ce of n.members) {
            for (const doc of docs) {
                doc.tryAddItem(ce, sf, docItem)
            }
        }
        
        // Eliminate empty doc categories
        docs = docs.filter(d => d.docItems.length > 0)
        return docs
    }
    
    override toMarkDownDetails(docItem: DocItem<ts.InterfaceDeclaration>, mdLinks: Record<string, string>) : string {
        let md = ''

        for (const doc of docItem.memberDocs) {
            for (const item of doc.docItems) {
                const details = doc.toMarkDownDetails(item, mdLinks)
                if (details)
                    md += details
            }
        }

        return md
    }
}

/**
 * @private
 */
export class DocEnumMember extends DocBase<ts.EnumMember> {
    constructor(sup: DocGenSupportApi) { super(sup, 'Member', 'Members') }

    override getName(item: ts.EnumMember): string {
        if (ts.isIdentifier(item.name))
            return item.name.text
        return ''
    }

    override filterItem(item: ts.Node): ts.EnumMember[] {
        if (ts.isEnumMember(item) && this.isNotPrivate(item))
            return [item]
        return []
    }

    override toMarkDownDetails(docItem: DocItem<ts.EnumMember>, mdLinks: Record<string, string>) : string {
        let md = ''

        md += this.examplesDetails(docItem)

        const comments = this.commentsDetails(docItem)

        if (md || comments) {
            const mdts = this.toTsMarkDown(docItem, mdLinks, true)
            let intro = `${this.sup.headingLevelMd(4)} Member ${docItem.name}${EOL}${EOL}`
            if (comments) intro += comments
            md = `${intro}${mdts}${EOL}${md}`
        }

        return md
    }
}

/**
 * @private
 */
export class DocEnum extends DocBase<ts.EnumDeclaration> {
    constructor(sup: DocGenSupportApi) { super(sup, 'Enum', 'Enums') }

    override getName(item: ts.EnumDeclaration): string {
        return item.name.text
    }

    override filterItem(item: ts.Node): ts.EnumDeclaration[] {
        if (ts.isEnumDeclaration(item) &&
            (this.sup.nothingPrivate || this.isExportedDeclaration(item)))
            return [item]
        return []
    }

    override extractMemberDocs(docItem: DocItem<ts.EnumDeclaration>) : DocBase<ts.Node>[] {
        const n = docItem.item
        const sf = docItem.sf

        let docs: DocBase<ts.Node>[] = [
            new DocEnumMember(this.sup)
        ]

        for (const ce of n.members) {
            for (const doc of docs) {
                doc.tryAddItem(ce, sf, docItem)
            }
        }
        
        // Eliminate empty doc categories
        docs = docs.filter(d => d.docItems.length > 0)
        return docs
    }
    
    override toMarkDownDetails(docItem: DocItem<ts.EnumDeclaration>, mdLinks: Record<string, string>) : string {
        let md = ''

        for (const doc of docItem.memberDocs) {
            for (const item of doc.docItems) {
                const details = doc.toMarkDownDetails(item, mdLinks)
                if (details)
                    md += details
            }
        }

        return md
    }
}

