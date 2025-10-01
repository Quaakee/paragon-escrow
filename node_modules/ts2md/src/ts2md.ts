#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from "fs";
import * as path from "path";
import { Ts2MdOptions } from "./Ts2MdOptions";
import { TypescriptToMarkdown } from "./TypescriptToMarkdown";


/**
 * Generate Typescript documentation and merge into README.md
 * 
 * Attempts to validate options, constructs an instance of Ts2Md with those options, and runs the generation method.
 * 
 * 1. Function argument is used if provided.
 * 
 * 2. Looks for `./ts2md.json`
 * 
 * 3. Default options.
 * 
 * Default options are:
 *
 * ```json
 * {
 *   "inputFilename": "./src/index.ts",
 *   "outputFilename": "./apiDoc.md",
 *   "firstHeadingLevel": 2,
 *   "noTitle": true,
 *   "outputReplace": true,
 *   "readmeMerge": true
 * }
 * ```
 * 
 * 4. Finally examines command line arguments which are treated as overrides of the options determined
 * by steps 1, 2, 3. Command line arguments can be provided as either:
 * 
 * ```
 * --inputFilename ../index.ts
 * ```
 *
 * or
 *
 * ```
 * --inputFilename=../index.ts
 * ```
 * 
 * @param options Optional options to control markdown generation.
 * @publicbody
 */
export function ts2md(options?: Ts2MdOptions) : void {
    if (!options) {
        try {
            const configPath = path.resolve('./ts2md.json')
            const json = fs.readFileSync(configPath, { encoding: 'utf8'})
            options = <Ts2MdOptions>JSON.parse(json)
        } catch {/* */}
    }
    if (!options?.options) {
        options ||= {
            inputFilename: './src/index.ts',
            outputFilename: '',
            firstHeadingLevel: 2,
            noTitle: true,
            readmeMerge: true,
            noDetailsSummary: false
            //nothingPrivate: true
        }
        const args = process.argv
        for (let i = 0; i < args.length; i++) {
            const arg = args[i]
            if (!arg.startsWith('--')) continue
            const e = arg.indexOf('=')
            let a = '', v = ''
            if (e > -1) {
                a = arg.slice(2, e)
                v = arg.slice(e + 1)
            } else {
                a = arg.slice(2)
                v = args[++i]
            }
            switch (a) {
                case 'inputFilename': options.inputFilename = v; break
                case 'outputFilename': options.outputFilename = v; break
                case 'firstHeadingLevel': options.firstHeadingLevel = <1 | 2 | 3>Number(v); break
                case 'noTitle': options.noTitle = (v === 'true'); break
                case 'readmeMerge': options.readmeMerge = (v === 'true'); break
                case 'nothingPrivate': options.nothingPrivate = (v === 'true'); break
                case 'filenameSubString': options.filenameSubString = v; break
                case 'noDetailsSummary': options.noDetailsSummary = (v === 'true'); break
                default: break
            }
        }
        console.log('ts2md(', options, ')')
    } else {
        console.log('ts2md command line ignored.\nts2md(', options, ')')
    }
    if (options.options) {
        const mdLinksEx: Record<string, string> = {}
        for (const o of options.options) {
            const t = new TypescriptToMarkdown(o)
            const r = t.run()
            const base = path.parse(r.outputPath).base
            for (const [key, mdLink] of Object.entries(r.mdLinks)) {
                if (!mdLinksEx[key]) {
                    mdLinksEx[key] = mdLink.replace('(#', `(./${base}#`)
                }
            }
        }
        for (const o of options.options) {
            const t = new TypescriptToMarkdown(o, mdLinksEx)
            t.run()
        }
    } else {
        new TypescriptToMarkdown(options).run()
    }
}

ts2md()