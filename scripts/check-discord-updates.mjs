/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ar = JSON.parse(fs.readFileSync(path.join(pluginDir, "ar.json"), "utf8"));
const cx = JSON.parse(fs.readFileSync(path.join(pluginDir, "complex_ar.json"), "utf8"));

const byText = ar.byText || {};
const byKey = ar.byKey || {};

function hasEnglishText(node) {
    if (typeof node === "string") return /[A-Za-z]{2,}/.test(node);
    if (!Array.isArray(node)) return false;
    const kind = node[0];
    if (kind === 5 || kind === 6) {
        return Object.values(node[2] || {}).some(branch => Array.isArray(branch) && branch.some(hasEnglishText));
    }
    if (kind === 8) {
        return Array.isArray(node[2]) && node[2].some(hasEnglishText);
    }
    return false;
}

function extractMessagesFromJs(text, liveSimple, liveComplex) {
    for (const m of text.matchAll(/JSON\.parse\('((?:\\.|[^'\\])*)'\)/g)) {
        try {
            const rawJson = Function(`return '${m[1]}'`)();
            const obj = JSON.parse(rawJson);
            if (!obj || typeof obj !== "object" || Array.isArray(obj)) continue;
            const entries = Object.entries(obj);
            if (entries.length === 0 || !entries.every(([k]) => /^[A-Za-z0-9+/]{6}$/.test(k))) {
                continue;
            }
            for (const [k, v] of entries) {
                if (Array.isArray(v) && v.length === 1 && typeof v[0] === "string") {
                    liveSimple[k] = v[0];
                } else if (typeof v === "string") {
                    liveSimple[k] = v;
                } else if (Array.isArray(v)) {
                    liveComplex[k] = v;
                }
            }
        } catch {
            // Ignore non-dictionary JSON chunks
        }
    }
}

const html = await (await fetch("https://discord.com/app")).text();
const entryScripts = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map(m => m[1]);

let allEntryJs = "";
const liveSimple = {};
const liveComplex = {};

for (let i = 0; i < entryScripts.length; i += 12) {
    await Promise.all(
        entryScripts.slice(i, i + 12).map(async src => {
            const txt = await (await fetch(`https://discord.com${src}`)).text();
            extractMessagesFromJs(txt, liveSimple, liveComplex);
            if (txt.includes('"en-US"') || txt.includes("p.u=e=>{")) {
                allEntryJs += `\n${txt}`;
            }
        }),
    );
}

const start = allEntryJs.indexOf("p.u=e=>{");
const chunkUrlMap = new Map();
if (start >= 0) {
    const end = allEntryJs.indexOf("},p.", start);
    const puBody = allEntryJs.slice(start, end + 1);
    for (const m of puBody.matchAll(/if\((\d+)===e\)return""\+e\+"\.([a-f0-9]+\.js)"/g)) {
        chunkUrlMap.set(m[1], `${m[1]}.${m[2]}`);
    }
    for (const m of puBody.matchAll(/(\d+):"([a-f0-9]+)"/g)) {
        chunkUrlMap.set(m[1], `${m[2]}.js`);
    }
}

const enUsIds = [...new Set([...allEntryJs.matchAll(/"en-US":[^}]*?\.e\((\d+)\)/g)].map(m => m[1]))];
for (let i = 0; i < enUsIds.length; i += 10) {
    await Promise.all(
        enUsIds.slice(i, i + 10).map(async id => {
            const fn = chunkUrlMap.get(id);
            if (!fn) return;
            const txt = await (await fetch(`https://discord.com/assets/${fn}`)).text();
            extractMessagesFromJs(txt, liveSimple, liveComplex);
        }),
    );
}

const missingSimple = Object.entries(liveSimple).filter(
    ([k, en]) => !(k in byKey) && !(en in byText) && /[A-Za-z]{2,}/.test(en),
);
const missingComplex = Object.entries(liveComplex).filter(
    ([k, ast]) => !(k in cx) && hasEnglishText(ast),
);

console.log(
    `Scanned ${Object.keys(liveSimple).length} simple + ${Object.keys(liveComplex).length} complex live Discord strings.`,
);
console.log(`Missing simple (English text): ${missingSimple.length}`);
for (const [k, v] of missingSimple.slice(0, 40)) {
    console.log(`  S[${k}] = ${JSON.stringify(v)}`);
}
console.log(`Missing complex (English text): ${missingComplex.length}`);
for (const [k, v] of missingComplex.slice(0, 25)) {
    console.log(`  C[${k}] = ${JSON.stringify(v)}`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = [
        "## Discord Live String Sync Report",
        `- Scanned live simple: \`${Object.keys(liveSimple).length}\``,
        `- Scanned live complex: \`${Object.keys(liveComplex).length}\``,
        `- Missing simple (with English words): \`${missingSimple.length}\``,
        `- Missing complex (with English words): \`${missingComplex.length}\``,
        "",
        ...(missingSimple.slice(0, 30).map(([k, v]) => `- \`${k}\`: ${JSON.stringify(v)}`)),
    ].join("\n");
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`, "utf8");
}
