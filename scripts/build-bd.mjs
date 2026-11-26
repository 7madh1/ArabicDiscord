/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(pluginDir, "betterdiscord", "ArabicDiscord.plugin.js");
const isCheck = process.argv.includes("--check");

const BD_META = `/**
 * @name ArabicDiscord
 * @author 7madh
 * @description Full Arabic localization for Discord with Arabic fonts and RTL layout support
 * @version 0.1.0
 * @source https://github.com/7madh1/ArabicDiscord
 * @updateUrl https://raw.githubusercontent.com/7madh1/ArabicDiscord/main/betterdiscord/ArabicDiscord.plugin.js
 */
`;

async function loadEsbuild() {
    const candidates = [
        path.resolve(pluginDir, "../../../node_modules/esbuild/lib/main.js"),
        path.resolve(pluginDir, "../../node_modules/esbuild/lib/main.js"),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return await import(pathToFileURL(candidate).href);
        }
    }
    return await import("esbuild");
}

function findIntlHashFile() {
    const candidates = [
        path.resolve(pluginDir, "../../../src/utils/intlHash.ts"),
        path.resolve(pluginDir, "../../utils/intlHash.ts"),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error("Could not locate Vencord src/utils/intlHash.ts");
}

const esbuild = await loadEsbuild();
const shimsPath = path.join(pluginDir, "betterdiscord", "shims.mjs");
const fetchShimPath = path.join(pluginDir, "betterdiscord", "fetch-shim.mjs");
const entryPath = path.join(pluginDir, "betterdiscord", "entry.mjs");
const cssPath = path.join(pluginDir, "styles.css");
const intlHashPath = findIntlHashFile();

const shimModules = {
    "@api/DataStore": `import { DataStore } from ${JSON.stringify(shimsPath)}; export const { get, set, getMany, setMany } = DataStore;`,
    "@api/Settings": `export { definePluginSettings } from ${JSON.stringify(shimsPath)};`,
    "@api/Styles": `export { enableStyle, disableStyle } from ${JSON.stringify(shimsPath)};`,
    "@components/Button": `export { StubComponent as Button } from ${JSON.stringify(shimsPath)};`,
    "@components/Flex": `export { StubComponent as Flex } from ${JSON.stringify(shimsPath)};`,
    "@components/Paragraph": `export { StubComponent as Paragraph } from ${JSON.stringify(shimsPath)};`,
    "@utils/Logger": `export { Logger } from ${JSON.stringify(shimsPath)};`,
    "@utils/types": `export { definePlugin as default, OptionType, StartAt } from ${JSON.stringify(shimsPath)};`,
    "@webpack": `export { find, waitFor } from ${JSON.stringify(shimsPath)};`,
    "@webpack/common": `export { FluxDispatcher, i18n, LocaleStore, Menu, moment, React, showToast } from ${JSON.stringify(shimsPath)};`,
};

const result = await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "browser",
    target: "es2022",
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    inject: [fetchShimPath],
    define: {
        IS_DEV: "false",
        IS_WEB: "false",
        IS_VESKTOP: "false",
    },
    plugins: [
        {
            name: "arabic-discord-bd-bundler",
            setup(build) {
                build.onResolve({ filter: /^@utils\/intlHash$/ }, () => ({
                    path: intlHashPath,
                }));
                build.onResolve({ filter: /^\.\/styles\.css\?managed$/ }, () => ({
                    path: cssPath,
                    namespace: "bd-css-text",
                }));
                build.onLoad({ filter: /.*/, namespace: "bd-css-text" }, args => ({
                    contents: `export default ${JSON.stringify(fs.readFileSync(args.path, "utf8").replace(/\r\n/g, "\n"))};`,
                    loader: "js",
                }));
                for (const id of Object.keys(shimModules)) {
                    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    build.onResolve({ filter: new RegExp(`^${escaped}$`) }, () => ({
                        path: id,
                        namespace: "bd-shim",
                    }));
                }
                build.onLoad({ filter: /.*/, namespace: "bd-shim" }, args => ({
                    contents: shimModules[args.path],
                    resolveDir: pluginDir,
                    loader: "js",
                }));
            },
        },
    ],
});

let bundleCode = result.outputFiles[0].text;
// Expose the BetterDiscord class directly as module.exports (not .default)
bundleCode += "\nif (module.exports && module.exports.default) { module.exports = module.exports.default; }\n";
const output = `${BD_META}${bundleCode}`.replace(/\r\n/g, "\n");

if (isCheck) {
    if (!fs.existsSync(outPath)) {
        console.error(`FAIL: Missing ${outPath}. Run node scripts/build-bd.mjs first.`);
        process.exit(1);
    }
    const existing = fs.readFileSync(outPath, "utf8").replace(/\r\n/g, "\n");
    if (existing !== output) {
        console.error("FAIL: ArabicDiscord.plugin.js is out of sync with source. Run node scripts/build-bd.mjs.");
        process.exit(1);
    }
    console.log("PASS: ArabicDiscord.plugin.js matches built output.");
} else {
    fs.writeFileSync(outPath, output, "utf8");
    const sizeKb = (Buffer.byteLength(output, "utf8") / 1024).toFixed(1);
    console.log(`Built ArabicDiscord.plugin.js (${sizeKb} KB).`);
}
