/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isPlainObject, isValidAstNode } from "../validation.mjs";

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(msg) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
}

const arPath = path.join(pluginDir, "ar.json");
const cxPath = path.join(pluginDir, "complex_ar.json");
const cssPath = path.join(pluginDir, "styles.css");
const indexPath = path.join(pluginDir, "index.tsx");

const ar = JSON.parse(fs.readFileSync(arPath, "utf8"));
const cx = JSON.parse(fs.readFileSync(cxPath, "utf8"));
const css = fs.readFileSync(cssPath, "utf8");
const idx = fs.readFileSync(indexPath, "utf8");

// 1. Validate ar.json structure, digits, spacing, and empty values
if (!isPlainObject(ar.byText)) fail("ar.json missing byText object");
if (!isPlainObject(ar.byKey)) fail("ar.json missing byKey object");

const indicRe = /[\u0660-\u0669\u06F0-\u06F9\u066A]/;
const doubleSpaceRe = /  +/;
const strictPunctRe = /(?:،،|\?\?|!\.|\.!|(?<!\.)\.\.(?!\.))/;

let arIssues = 0;
for (const [storeName, store] of [["byText", ar.byText], ["byKey", ar.byKey]]) {
    for (const [k, v] of Object.entries(store || {})) {
        if (typeof v !== "string" || !v.trim()) {
            fail(`ar.${storeName} empty value for ${JSON.stringify(k)}`);
            arIssues++;
        } else if (indicRe.test(v)) {
            fail(`ar.${storeName} contains Arabic-Indic digit in ${JSON.stringify(k)}`);
            arIssues++;
        } else if (doubleSpaceRe.test(v)) {
            fail(`ar.${storeName} contains double space in ${JSON.stringify(k)}`);
            arIssues++;
        } else if (strictPunctRe.test(v)) {
            fail(`ar.${storeName} contains punctuation glitch in ${JSON.stringify(k)}`);
            arIssues++;
        }
        if (arIssues >= 25) break;
    }
}

// 2. Validate complex_ar.json AST nodes using shared strict schema validator
let cxIssues = 0;
for (const [key, ast] of Object.entries(cx)) {
    if (!Array.isArray(ast)) {
        fail(`complex_ar[${key}] root is not an array`);
        cxIssues++;
        continue;
    }
    for (const node of ast) {
        if (cxIssues >= 25) break;
        const ok = isValidAstNode(node, text => {
            if (indicRe.test(text)) {
                fail(`complex_ar[${key}] contains Arabic-Indic digit: ${JSON.stringify(text)}`);
                cxIssues++;
            } else if (doubleSpaceRe.test(text)) {
                fail(`complex_ar[${key}] contains double space: ${JSON.stringify(text)}`);
                cxIssues++;
            } else if (strictPunctRe.test(text)) {
                fail(`complex_ar[${key}] contains punctuation glitch: ${JSON.stringify(text)}`);
                cxIssues++;
            }
        });
        if (!ok) {
            fail(`complex_ar[${key}] failed strict AST schema check: ${JSON.stringify(node)}`);
            cxIssues++;
        }
    }
}

// 3. Validate styles.css brace balance & index.tsx metadata
let depth = 0;
for (const ch of css) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth < 0) {
        fail("styles.css has unmatched closing brace");
        break;
    }
}
if (depth !== 0) fail(`styles.css has unbalanced braces (depth=${depth})`);

if (!idx.includes("GPL-3.0-or-later")) fail("index.tsx missing GPL-3.0-or-later header");
if (!idx.includes("definePlugin(")) fail("index.tsx missing definePlugin");

if (!process.exitCode) {
    const arCount = Object.keys(ar.byText).length;
    const cxCount = Object.keys(cx).length;
    console.log(`PASS: ${arCount} simple entries, ${cxCount} complex AST entries, CSS & TSX valid.`);
}
