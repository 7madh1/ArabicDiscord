/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { isValidAstNode, isValidDictionaries } from "../validation.mjs";

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arJson = JSON.parse(fs.readFileSync(path.join(pluginDir, "ar.json"), "utf8"));
const complexJson = JSON.parse(fs.readFileSync(path.join(pluginDir, "complex_ar.json"), "utf8"));

test("AST schema accepts valid node kinds 1..8 and nested branches", () => {
    assert.equal(isValidAstNode("نص عربي"), true);
    assert.equal(isValidAstNode([1, "username"]), true);
    assert.equal(isValidAstNode([2, "count"]), true);
    assert.equal(isValidAstNode([2, "count", "percent"]), true);
    assert.equal(isValidAstNode([3, "createdAt", "short"]), true);
    assert.equal(isValidAstNode([4, "updatedAt", "medium"]), true);
    assert.equal(isValidAstNode([7]), true);
    assert.equal(
        isValidAstNode([5, "gender", { male: ["مرحباً ", [1, "name"]], other: ["أهلاً"] }]),
        true,
    );
    assert.equal(
        isValidAstNode([
            6,
            "members",
            { "=-1": ["[جاري الحساب...]"], "=0": [], one: [[7], " عضو"], other: [[7], " أعضاء"] },
            0,
            "cardinal",
        ]),
        true,
    );
    assert.equal(isValidAstNode([8, "$b", ["نص ", [7]], ["attr"]]), true);
});

test("AST schema rejects malformed or corrupt node shapes", () => {
    assert.equal(isValidAstNode(null), false);
    assert.equal(isValidAstNode(123), false);
    assert.equal(isValidAstNode([]), false);
    assert.equal(isValidAstNode([99, "unknown"]), false);
    assert.equal(isValidAstNode([1]), false);
    assert.equal(isValidAstNode([1, ""]), false);
    assert.equal(isValidAstNode([1, "x", "extra"]), false);
    assert.equal(isValidAstNode([7, "unexpected"]), false);
    assert.equal(isValidAstNode([3, "dt", 42]), false);
    assert.equal(isValidAstNode([5, "sel", null]), false);
    assert.equal(isValidAstNode([5, "sel", {}]), false);
    assert.equal(isValidAstNode([6, "count", { one: [[7]] }, "0", "cardinal"]), false);
    assert.equal(isValidAstNode([6, "count", { one: [[7]] }, 0, "badType"]), false);
    assert.equal(isValidAstNode([6, "count", { bogus: ["x"] }, 0, "cardinal"]), false);
    assert.equal(isValidAstNode([6, "count", { one: [7, "broken"] }, 0, "cardinal"]), false);
    assert.equal(isValidAstNode([8, "$b", "not-array"]), false);
    assert.equal(isValidAstNode([8, "$b", ["ok"], "not-array"]), false);
});

test("Full ar.json and complex_ar.json pass runtime dictionary validation", () => {
    assert.equal(isValidDictionaries(arJson, complexJson), true);

    assert.equal(
        isValidDictionaries({ byText: { Settings: "الإعدادات" } }, complexJson),
        false,
    );
    assert.equal(
        isValidDictionaries(
            arJson,
            { ...complexJson, brokenKey: [[6, "count", { one: [7, "bad"] }, 0, "cardinal"]] },
        ),
        false,
    );
});

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
    try {
        return await import("esbuild");
    } catch {
        return null;
    }
}

test("Plugin lifecycle: stop restores dynamic locales/formatters & guards concurrent/failed sync", async t => {
    const esbuild = await loadEsbuild();
    if (!esbuild) {
        t.skip("esbuild unavailable outside Vencord workspace");
        return;
    }

    const harness = {
        store: new Map(),
        stylesEnabled: false,
        toasts: [],
        fluxHandlers: new Map(),
        currentMomentLocale: "en",
        currentIntlLocale: "en-US",
        localeEmits: 0,
        origDateFormatterCalls: 0,
        discordUtils: {
            createDateFormatter(locale, _opts) {
                return () => {
                    harness.origDateFormatterCalls++;
                    return `native:${locale}`;
                };
            },
        },
        intlObject: {
            currentLocale: "en-US",
            setLocale(next) {
                harness.currentIntlLocale = next;
                this.currentLocale = next;
            },
            formatToPlainString: m => String(m),
            formatToParts: m => [String(m)],
            format: m => String(m),
            withFormatters: () => harness.intlObject,
        },
    };
    const origDateFormatter = harness.discordUtils.createDateFormatter;

    globalThis.__ARABIC_TEST_HARNESS__ = harness;
    globalThis.window = globalThis;
    globalThis.setTimeout = setTimeout;
    globalThis.clearTimeout = clearTimeout;
    globalThis.DiscordNative = {
        nativeModules: {
            requireModule: name => (name === "discord_utils" ? harness.discordUtils : undefined),
        },
    };
    const rootAttrs = new Map();
    const rootStyle = new Map();
    globalThis.MutationObserver = class {
        observe() {}
        disconnect() {}
    };
    globalThis.document = {
        readyState: "complete",
        documentElement: {
            setAttribute(k, v) {
                rootAttrs.set(k, String(v));
            },
            getAttribute(k) {
                return rootAttrs.get(k) ?? null;
            },
            removeAttribute(k) {
                rootAttrs.delete(k);
            },
            style: {
                setProperty(k, v) {
                    rootStyle.set(k, String(v));
                },
                removeProperty(k) {
                    rootStyle.delete(k);
                },
            },
        },
        head: null,
        body: null,
        getElementById: () => null,
        querySelectorAll: () => [],
    };

    const virtualMocks = {
        "@api/DataStore": `
            const h = () => globalThis.__ARABIC_TEST_HARNESS__;
            export const get = async k => h().store.get(k);
            export const set = async (k, v) => { h().store.set(k, v); };
            export const getMany = async keys => keys.map(k => h().store.get(k));
            export const setMany = async entries => { for (const [k, v] of entries) h().store.set(k, v); };
        `,
        "@api/Settings": `
            export const definePluginSettings = def => {
                const store = Object.fromEntries(Object.entries(def).map(([k, v]) => [k, v.default]));
                return {
                    store,
                    use: () => store,
                };
            };
        `,
        "@api/Styles": `
            const h = () => globalThis.__ARABIC_TEST_HARNESS__;
            export const enableStyle = () => { h().stylesEnabled = true; };
            export const disableStyle = () => { h().stylesEnabled = false; };
        `,
        "@components/Button": "export const Button = () => null;",
        "@components/Flex": "export const Flex = () => null;",
        "@components/Paragraph": "export const Paragraph = () => null;",
        "@utils/intlHash": "export const runtimeHashMessageKey = k => k;",
        "@utils/Logger": "export class Logger { info() {} warn() {} error() {} }",
        "@utils/types": `
            export default p => p;
            export const OptionType = { SELECT: 0, SLIDER: 1, BOOLEAN: 2, COMPONENT: 3 };
            export const StartAt = { Init: "Init" };
        `,
        "@webpack": `
            const h = () => globalThis.__ARABIC_TEST_HARNESS__;
            export const find = () => undefined;
            export const waitFor = (filter, cb) => {
                if (filter === "parseTwoDigitYear") cb();
                else if (Array.isArray(filter) && filter.includes("dispatch")) {
                    cb({
                        subscribe: (ev, fn) => {
                            if (!h().fluxHandlers.has(ev)) h().fluxHandlers.set(ev, new Set());
                            h().fluxHandlers.get(ev).add(fn);
                        },
                        unsubscribe: (ev, fn) => h().fluxHandlers.get(ev)?.delete(fn),
                    });
                } else if (typeof filter === "function") {
                    if (filter({ getName: () => "LocaleStore" })) cb();
                    else if (filter({ withFormatters: true })) cb(h().intlObject);
                }
            };
        `,
        "@webpack/common": `
            const h = () => globalThis.__ARABIC_TEST_HARNESS__;
            export const FluxDispatcher = {
                subscribe: (ev, fn) => {
                    if (!h().fluxHandlers.has(ev)) h().fluxHandlers.set(ev, new Set());
                    h().fluxHandlers.get(ev).add(fn);
                },
                unsubscribe: (ev, fn) => h().fluxHandlers.get(ev)?.delete(fn),
            };
            export const i18n = { get intl() { return h().intlObject; } };
            export const LocaleStore = { emitChange: () => { h().localeEmits++; } };
            export const Menu = {
                MenuItem: "MenuItem",
                MenuCheckboxItem: "MenuCheckboxItem",
            };
            export const moment = {
                defineLocale() {},
                locale(next) {
                    if (next !== undefined) h().currentMomentLocale = next;
                    return h().currentMomentLocale;
                },
            };
            export const React = {
                Fragment: "Fragment",
                createElement: (type, props, ...children) => ({
                    type,
                    props: props || {},
                    children,
                }),
            };
            export const showToast = t => { h().toasts.push(t); };
        `,
        "./styles.css?managed": "export default {};",
    };

    let fetchMode = "ok";
    let fetchCount = 0;
    const prevFetch = globalThis.fetch;
    globalThis.fetch = async url => {
        fetchCount++;
        if (fetchMode === "fail") {
            throw new Error("Simulated offline error");
        }
        if (fetchMode === "corrupt") {
            return {
                ok: true,
                status: 200,
                json: async () =>
                    (String(url).includes("complex")
                        ? { broken: [[6, "c", { one: [7, "x"] }, 0, "cardinal"]] }
                        : arJson),
            };
        }
        await new Promise(r => setTimeout(r, 20));
        return {
            ok: true,
            status: 200,
            json: async () => (String(url).includes("complex") ? complexJson : arJson),
        };
    };

    const tmpOut = path.join(os.tmpdir(), `arabic-discord-runtime-${Date.now()}.mjs`);
    let pluginRef = null;
    try {
        await esbuild.build({
            entryPoints: [path.join(pluginDir, "index.tsx")],
            bundle: true,
            write: true,
            outfile: tmpOut,
            format: "esm",
            platform: "browser",
            jsx: "transform",
            jsxFactory: "React.createElement",
            jsxFragment: "React.Fragment",
            define: {
                IS_DEV: "false",
                IS_WEB: "false",
                IS_VESKTOP: "false",
            },
            plugins: [
                {
                    name: "arabic-discord-test-mocks",
                    setup(build) {
                        for (const id of Object.keys(virtualMocks)) {
                            const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                            build.onResolve({ filter: new RegExp(`^${escaped}$`) }, () => ({
                                path: id,
                                namespace: "test-mock",
                            }));
                        }
                        build.onLoad({ filter: /.*/, namespace: "test-mock" }, args => ({
                            contents: virtualMocks[args.path],
                            loader: "js",
                        }));
                    },
                },
            ],
        });

        const { default: plugin } = await import(pathToFileURL(tmpOut).href);
        pluginRef = plugin;

        // 1. Start plugin -> patches formatter, locale, styles, caches dictionaries
        plugin.start();
        await new Promise(r => setTimeout(r, 60));

        assert.equal(harness.stylesEnabled, true);
        assert.equal(rootAttrs.get("data-arabic-font"), "cairo");
        assert.equal(rootAttrs.get("dir"), "ltr");
        assert.notEqual(harness.discordUtils.createDateFormatter, origDateFormatter);
        assert.equal(harness.currentMomentLocale, "ar-discord");
        assert.equal(harness.currentIntlLocale, "ar-u-nu-latn");
        assert.ok(harness.store.get("ArabicDiscord_ar_v1")?.byText);

        // Concurrent manual refresh guard prevents overlapping fetches
        function findMenuAction(node, id) {
            if (!node || typeof node !== "object") return null;
            if (node.props?.id === id && typeof node.props.action === "function") {
                return node.props.action;
            }
            if (Array.isArray(node.children)) {
                for (const child of node.children) {
                    const hit = findMenuAction(child, id);
                    if (hit) return hit;
                }
            }
            return null;
        }

        const rtlToggle = findMenuAction(
            plugin.toolboxActions(),
            "arabic-discord-rtl-toggle",
        );
        assert.equal(typeof rtlToggle, "function");
        rtlToggle();
        assert.equal(rootAttrs.get("data-arabic-rtl"), "1");
        assert.equal(rootAttrs.get("dir"), "rtl");

        const refreshAction = findMenuAction(
            plugin.toolboxActions(),
            "arabic-discord-update-translations",
        );
        assert.equal(typeof refreshAction, "function");

        const priorFetches = fetchCount;
        refreshAction();
        refreshAction();
        await new Promise(r => setTimeout(r, 60));
        assert.equal(fetchCount - priorFetches, 2);

        // Failed or corrupt update preserves last valid DataStore cache
        fetchMode = "fail";
        refreshAction();
        await new Promise(r => setTimeout(r, 30));
        assert.equal(harness.toasts.at(-1)?.variant, "critical");
        assert.ok(harness.store.get("ArabicDiscord_ar_v1")?.byText);

        fetchMode = "corrupt";
        refreshAction();
        await new Promise(r => setTimeout(r, 30));
        assert.equal(harness.toasts.at(-1)?.variant, "critical");
        assert.ok(harness.store.get("ArabicDiscord_complex_v1") && !harness.store.get("ArabicDiscord_complex_v1").broken);

        // 2. Stop plugin -> must restore original formatter cleanly without re-patching
        plugin.stop();
        assert.equal(harness.stylesEnabled, false);
        assert.equal(rootAttrs.has("data-arabic-font"), false);
        assert.equal(rootAttrs.has("data-arabic-rtl"), false);
        assert.equal(harness.discordUtils.createDateFormatter, origDateFormatter);
        assert.equal(harness.currentMomentLocale, "en");
        assert.equal(harness.currentIntlLocale, "en-US");

        // 3. Switch Discord language while stopped -> restart & stop must restore NEW language
        harness.currentMomentLocale = "fr";
        harness.intlObject.setLocale("fr");
        fetchMode = "ok";
        plugin.start();
        await new Promise(r => setTimeout(r, 40));
        assert.equal(harness.currentMomentLocale, "ar-discord");
        assert.equal(harness.currentIntlLocale, "ar-u-nu-latn");

        plugin.stop();
        assert.equal(harness.discordUtils.createDateFormatter, origDateFormatter);
        assert.equal(harness.currentMomentLocale, "fr");
        assert.equal(harness.currentIntlLocale, "fr");
    } finally {
        try {
            pluginRef?.stop?.();
        } catch {
            // Ignore cleanup errors if test failed mid-setup
        }
        globalThis.fetch = prevFetch;
        delete globalThis.__ARABIC_TEST_HARNESS__;
        if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    }
});
