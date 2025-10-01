import * as fs from "fs";
import { EOL } from "os"

/**
 * Quick and dirty README.md merge function.
 * 
 * The anchors must not be indented and must exactly match:
 * 
 *    `<!--#region ts2md-api-merged-here-->`
 * 
 *    `<!--#endregion ts2md-api-merged-here-->`
 * 
 * @param md The markdown to insert between the start and end anchors.
 * @param mergePath Fully resolved path to create or update.
 */
export function mdMerge(md: string, mergePath: string, requireAnchors = true) : void {

    let preMergeMd: string
    try {
        preMergeMd = fs.readFileSync(mergePath, { encoding: 'utf8' })
    } catch {
        fs.writeFileSync(mergePath, md);
        return
    }
    
    const mergeStartAnchor = `<!--#region ts2md-api-merged-here-->`
    const mergeEndAnchor = `<!--#endregion ts2md-api-merged-here-->`
    
    let posStart = preMergeMd.indexOf('\n' + mergeStartAnchor)
    let posEnd = preMergeMd.indexOf('\n' + mergeEndAnchor)

    if (posStart > -1 && posEnd > -1 && posStart < posEnd) {
        posStart++
        posEnd++
        const mergedMd = preMergeMd.slice(0, posStart + mergeStartAnchor.length) +
         EOL + md + EOL +
         preMergeMd.slice(posEnd)
        try { fs.unlinkSync(mergePath) } catch { /* */ }
        fs.writeFileSync(mergePath, mergedMd)
    } else if (requireAnchors) {
        console.error(`
ts2md anchors missing or inverted in README.md

Be sure to add exactly:

<!--#region ts2md-api-merged-here-->
<!--#endregion ts2md-api-merged-here-->

`)
    } else {
        try { fs.unlinkSync(mergePath); } catch { /* */ }
        fs.writeFileSync(mergePath, md);
    }
}