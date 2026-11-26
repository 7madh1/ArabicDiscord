/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { isValidAstNode, isValidDictionaries, MAX_AST_DEPTH } from "../validation.mjs";

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arJson = JSON.parse(fs.readFileSync(path.join(pluginDir, "ar.json"), "utf8"));
const complexJson = JSON.parse(fs.readFileSync(path.join(pluginDir, "complex_ar.json"), "utf8"));

test("AST schema test matrix validates all node kinds 1..8, plural 'other', and nesting depth", () => {
    const validCases = [
        "نص عربي",
        [1, "username"],
        [2, "count"],
        [2, "count", "percent"],
        [3, "createdAt"],
        [3, "createdAt", "short"],
        [4, "updatedAt"],
        [4, "updatedAt", "medium"],
        [5, "nth", { 1: ["الأول"], 2: ["الثاني"] }],
        [5, "gender", { male: ["مرحباً ", [1, "name"]], other: ["أهلاً"] }],
        [6, "members", { "=-1": ["[جاري الحساب...]"], "=0": [], one: [[7], " عضو"], other: [[7], " أعضاء"] }, 0, "cardinal"],
        [6, "rank", { one: [[7], "st"], other: [[7], "th"] }, 1, "ordinal"],
        [7],
        [8, "$b", ["نص ", [7]]],
        [8, "$link", ["اضغط هنا"], ["href"]],
    ];
    for (const node of validCases) {
        assert.equal(isValidAstNode(node), true, `Expected valid AST node: ${JSON.stringify(node)}`);
    }

    const invalidCases = [
        null,
        123,
        [],
        [0, "zero"],
        [99, "unknown"],
        [1],
        [1, ""],
        [1, "x", "extra"],
        [2, "count", 123],
        [3, "dt", 42],
        [4, "tm", null],
        [5, "sel", null],
        [5, "sel", {}],
        [5, "sel", { other: "not-array" }],
        [5, "sel", { other: ["ok"] }, "extra"],
        [6, "count", { one: ["واحد"] }, 0, "cardinal"], // missing required `other`
        [6, "count", { other: ["x"] }, 1.5, "cardinal"], // non-integer offset
        [6, "count", { other: ["x"] }, "0", "cardinal"],
        [6, "count", { one: [[7]], other: [[7]] }, 0, "badType"],
        [6, "count", { bogus: ["x"], other: ["y"] }, 0, "cardinal"],
        [6, "count", { one: [7, "broken"], other: ["y"] }, 0, "cardinal"],
        [7, "unexpected"],
        [8, "$b", "not-array"],
        [8, "$b", ["ok"], "not-array"],
        [8, "", ["empty-tag"]],
    ];
    for (const node of invalidCases) {
        assert.equal(isValidAstNode(node), false, `Expected invalid AST node: ${JSON.stringify(node)}`);
    }

    // Depth boundary: exact MAX_AST_DEPTH passes; MAX_AST_DEPTH + 1 fails cleanly without stack overflow
    let validDeep = "leaf";
    for (let i = 0; i < MAX_AST_DEPTH; i++) {
        validDeep = [8, "span", [validDeep]];
    }
    assert.equal(isValidAstNode(validDeep), true);

    const tooDeep = [8, "span", [validDeep]];
    assert.equal(isValidAstNode(tooDeep), false);
});

test("Full ar.json and complex_ar.json pass runtime dictionary validation and max depth check", () => {
    assert.equal(isValidDictionaries(arJson, complexJson), true);

    let maxObservedDepth = 0;
    const measureDepth = (node, depth = 0) => {
        if (depth > maxObservedDepth) maxObservedDepth = depth;
        if (!Array.isArray(node)) return;
        const kind = node[0];
        if (kind === 5 || kind === 6) {
            for (const branch of Object.values(node[2])) {
                for (const child of branch) measureDepth(child, depth + 1);
            }
        } else if (kind === 8) {
            for (const child of node[2]) measureDepth(child, depth + 1);
            if (node[3]) {
                for (const child of node[3]) measureDepth(child, depth + 1);
            }
        }
    };
    for (const ast of Object.values(complexJson)) {
        for (const node of ast) measureDepth(node, 0);
    }
    assert.ok(maxObservedDepth > 0 && maxObservedDepth < MAX_AST_DEPTH, `Unexpected depth=${maxObservedDepth}`);

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

function captureGlobals(keys) {
    const snapshot = new Map();
    for (const key of keys) {
        snapshot.set(key, {
            existed: Object.prototype.hasOwnProperty.call(globalThis, key),
            value: globalThis[key],
        });
    }
    return () => {
        for (const [key, entry] of snapshot.entries()) {
            if (entry.existed) {
                globalThis[key] = entry.value;
            } else {
                delete globalThis[key];
            }
        }
    };
}

test("Plugin lifecycle: 10x start/stop stress, locale switch, in-flight stop race, and failed sync", async t => {
    const esbuild = await loadEsbuild();
    if (!esbuild) {
        t.skip("esbuild unavailable outside Vencord workspace");
        return;
    }

    const restoreGlobals = captureGlobals([
        "__ARABIC_TEST_HARNESS__",
        "window",
        "DiscordNative",
        "MutationObserver",
        "document",
        "fetch",
        "setTimeout",
        "clearTimeout",
    ]);

    const harness = {
        store: new Map(),
        stylesEnabled: false,
        toasts: [],
        fluxHandlers: new Map(),
        currentMomentLocale: "en",
        currentIntlLocale: "en-US",
        localeEmits: 0,
        discordUtils: {
            createDateFormatter(locale) {
                return () => `native:${locale}`;
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

    const rootAttrs = new Map();
    const rootStyle = new Map();
    globalThis.__ARABIC_TEST_HARNESS__ = harness;
    globalThis.window = globalThis;
    globalThis.setTimeout = setTimeout;
    globalThis.clearTimeout = clearTimeout;
    globalThis.MutationObserver = class {
        observe() {}
        disconnect() {}
    };
    globalThis.DiscordNative = {
        nativeModules: {
            requireModule: name => (name === "discord_utils" ? harness.discordUtils : undefined),
        },
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
            export const setMany = async entries => {
                if (h().beforeSetMany) {
                    await h().beforeSetMany(entries);
                }
                for (const [k, v] of entries) h().store.set(k, v);
            };
        `,
        "@api/Settings": `
            export const definePluginSettings = def => {
                const store = Object.fromEntries(Object.entries(def).map(([k, v]) => [k, v.default]));
                return { store, use: () => store };
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
    let deferredFetchGate = null;
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
                        ? { broken: [[6, "c", { one: ["x"] }, 0, "cardinal"]] }
                        : arJson),
            };
        }
        if (deferredFetchGate) {
            await deferredFetchGate;
        } else {
            await new Promise(r => setTimeout(r, 15));
        }
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

        // Toggle RTL from toolbox & verify attributes
        const rtlToggle = findMenuAction(plugin.toolboxActions(), "arabic-discord-rtl-toggle");
        assert.equal(typeof rtlToggle, "function");
        rtlToggle();
        assert.equal(rootAttrs.get("data-arabic-rtl"), "1");
        assert.equal(rootAttrs.get("dir"), "rtl");

        // Concurrent manual refresh guard prevents overlapping fetches
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

        // 2. Stop during an in-flight fetch must not leave plugin active or styles enabled
        fetchMode = "ok";
        let releaseFetch;
        deferredFetchGate = new Promise(resolve => {
            releaseFetch = resolve;
        });
        refreshAction();
        plugin.stop();
        releaseFetch();
        deferredFetchGate = null;
        await new Promise(r => setTimeout(r, 30));

        assert.equal(harness.stylesEnabled, false);
        assert.equal(rootAttrs.has("data-arabic-font"), false);
        assert.equal(rootAttrs.has("data-arabic-rtl"), false);
        assert.equal(harness.discordUtils.createDateFormatter, origDateFormatter);
        assert.equal(harness.currentMomentLocale, "en");
        assert.equal(harness.currentIntlLocale, "en-US");

        // 2b. Stop -> immediate Start -> delayed stale request from old generation settles late:
        // must NOT overwrite DataStore, must NOT fire stale toast, and must NOT block new session sync.
        fetchMode = "ok";
        let releaseStaleFetch;
        const staleGate = new Promise(resolve => {
            releaseStaleFetch = resolve;
        });
        let staleCallsRemaining = 2;
        const origFetchForRace = globalThis.fetch;
        const seenSignals = [];
        globalThis.fetch = async (url, opts) => {
            if (opts?.signal) seenSignals.push(opts.signal);
            if (staleCallsRemaining > 0) {
                staleCallsRemaining--;
                await staleGate;
                return {
                    ok: true,
                    status: 200,
                    json: async () =>
                        (String(url).includes("complex")
                            ? complexJson
                            : { ...arJson, byText: { ...arJson.byText, __STALE_MARKER__: "قديم" } }),
                };
            }
            return origFetchForRace(url, opts);
        };

        try {
            plugin.start();
            await new Promise(r => setTimeout(r, 15));
            refreshAction(); // starts gen N fetch (stalled on staleGate)
            plugin.stop(); // aborts & invalidates gen N
            assert.equal(seenSignals.at(-1)?.aborted, true);

            const toastsBeforeRestart = harness.toasts.length;
            plugin.start(); // starts gen N+1
            refreshAction(); // fresh fetch in gen N+1 must NOT be blocked by old isCheckingRemoteUpdates
            await new Promise(r => setTimeout(r, 35));

            releaseStaleFetch();
            await new Promise(r => setTimeout(r, 25));

            assert.equal(harness.store.get("ArabicDiscord_ar_v1")?.byText?.__STALE_MARKER__, undefined);
            assert.equal(
                harness.toasts.slice(toastsBeforeRestart).some(toast => toast.variant === "critical"),
                false,
            );
            plugin.stop();
        } finally {
            globalThis.fetch = origFetchForRace;
        }

        // 2c. Cache consistency race: Start -> Resolve fetch -> Hold old DataStore.setMany ->
        // Stop -> Start new generation -> New refresh -> Release old setMany -> Complete new refresh ->
        // Assert final persistent DataStore cache belongs to newest generation, not held older write.
        let releaseOldSetMany;
        const oldSetManyGate = new Promise(resolve => {
            releaseOldSetMany = resolve;
        });
        let notifyOldSetManyEntered;
        const oldSetManyEntered = new Promise(resolve => {
            notifyOldSetManyEntered = resolve;
        });
        let holdNextSetMany = true;
        let fetchGenerationTag = "gen-old";
        const origFetchForPersistRace = globalThis.fetch;

        harness.beforeSetMany = async () => {
            if (holdNextSetMany) {
                holdNextSetMany = false;
                notifyOldSetManyEntered();
                await oldSetManyGate;
            }
        };
        globalThis.fetch = async url => {
            const tag = fetchGenerationTag;
            return {
                ok: true,
                status: 200,
                json: async () =>
                    (String(url).includes("complex")
                        ? complexJson
                        : { ...arJson, byText: { ...arJson.byText, __PERSIST_TAG__: tag } }),
            };
        };

        try {
            plugin.start();
            await new Promise(r => setTimeout(r, 15));

            refreshAction(); // Gen N fetches "gen-old" and blocks inside DataStore.setMany
            await oldSetManyEntered;

            plugin.stop();
            fetchGenerationTag = "gen-new";
            plugin.start();
            refreshAction(); // Gen N+1 fetches "gen-new" and queues write behind held Gen N write
            await new Promise(r => setTimeout(r, 25));

            releaseOldSetMany(); // Complete old Gen N setMany first, then Gen N+1 queued write completes
            await new Promise(r => setTimeout(r, 40));

            assert.equal(harness.store.get("ArabicDiscord_ar_v1")?.byText?.__PERSIST_TAG__, "gen-new");
            plugin.stop();
        } finally {
            harness.beforeSetMany = null;
            globalThis.fetch = origFetchForPersistRace;
        }

        // 3. Stress test: 10 consecutive start/stop cycles + Discord locale changes leave zero leaks
        const testLocales = ["fr", "de", "ja", "es-ES", "en-US"];
        for (let i = 0; i < 10; i++) {
            const expectedLocale = testLocales[i % testLocales.length];
            harness.currentMomentLocale = expectedLocale;
            harness.intlObject.setLocale(expectedLocale);

            plugin.start();
            await new Promise(r => setTimeout(r, 10));
            assert.equal(harness.stylesEnabled, true);
            assert.equal(harness.currentMomentLocale, "ar-discord");
            assert.equal(harness.currentIntlLocale, "ar-u-nu-latn");
            assert.notEqual(harness.discordUtils.createDateFormatter, origDateFormatter);

            plugin.stop();
            assert.equal(harness.stylesEnabled, false);
            assert.equal(harness.discordUtils.createDateFormatter, origDateFormatter);
            assert.equal(harness.currentMomentLocale, expectedLocale);
            assert.equal(harness.currentIntlLocale, expectedLocale);
            for (const handlers of harness.fluxHandlers.values()) {
                assert.equal(handlers.size, 0, "Expected Flux handlers unsubscribed after stop()");
            }
        }
    } finally {
        try {
            pluginRef?.stop?.();
        } catch {
            // Ignore cleanup errors if test failed mid-setup
        }
        restoreGlobals();
        if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    }
});

test("BetterDiscord ArabicDiscord.plugin.js runs start/settings/sync/stop cleanly with BdApi", async t => {
    const bdPluginPath = path.join(pluginDir, "betterdiscord", "ArabicDiscord.plugin.js");
    if (!fs.existsSync(bdPluginPath)) {
        t.skip("ArabicDiscord.plugin.js not built yet");
        return;
    }

    const restoreGlobals = captureGlobals([
        "BdApi",
        "window",
        "DiscordNative",
        "MutationObserver",
        "document",
        "fetch",
        "setTimeout",
        "clearTimeout",
        "Node",
    ]);

    const bdData = new Map();
    const bdStyles = new Map();
    const bdToasts = [];
    let bdNetFetches = 0;
    const rootAttrs = new Map();
    const rootStyle = new Map();
    let currentMomentLocale = "en";
    let currentIntlLocale = "en-US";
    const fluxHandlers = new Map();

    const makeMockEl = tag => {
        const listeners = new Map();
        const attrs = new Map();
        return {
            tagName: tag,
            children: [],
            style: {},
            dir: "",
            type: "",
            value: "",
            checked: false,
            className: "",
            textContent: "",
            setAttribute(k, v) {
                attrs.set(k, String(v));
            },
            getAttribute(k) {
                return attrs.get(k) ?? null;
            },
            appendChild(child) {
                this.children.push(child);
                return child;
            },
            addEventListener(ev, fn) {
                listeners.set(ev, fn);
            },
            dispatch(ev) {
                listeners.get(ev)?.();
            },
            click() {
                listeners.get("click")?.();
            },
        };
    };

    const discordUtils = {
        createDateFormatter(locale) {
            return () => `native:${locale}`;
        },
    };
    const origDateFormatter = discordUtils.createDateFormatter;

    const intlProto = {
        withFormatters: () => intlObj,
    };
    const intlObj = Object.assign(Object.create(intlProto), {
        currentLocale: "en-US",
        setLocale(next) {
            currentIntlLocale = next;
            this.currentLocale = next;
        },
        formatToPlainString: m => String(m),
        formatToParts: m => [String(m)],
        format: m => String(m),
    });

    const fluxDispatcher = {
        dispatch() {},
        subscribe(ev, fn) {
            if (!fluxHandlers.has(ev)) fluxHandlers.set(ev, new Set());
            fluxHandlers.get(ev).add(fn);
        },
        unsubscribe(ev, fn) {
            fluxHandlers.get(ev)?.delete(fn);
        },
    };

    const momentMod = {
        parseTwoDigitYear: () => 2026,
        defineLocale() {},
        locale(next) {
            if (next !== undefined) currentMomentLocale = next;
            return currentMomentLocale;
        },
    };

    const localeStore = {
        getName: () => "LocaleStore",
        emitChange() {},
    };

    let pluginInstance = null;

    try {
        globalThis.window = globalThis;
        globalThis.setTimeout = setTimeout;
        globalThis.clearTimeout = clearTimeout;
        globalThis.Node = class MockNode {};
        globalThis.MutationObserver = class {
            observe() {}
            disconnect() {}
        };
        globalThis.DiscordNative = {
            nativeModules: {
                requireModule: name => (name === "discord_utils" ? discordUtils : undefined),
            },
        };
        globalThis.document = {
            readyState: "complete",
            createElement: tag => makeMockEl(tag),
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

        globalThis.BdApi = {
            Data: {
                load: (p, k) => bdData.get(`${p}:${k}`),
                save: (p, k, v) => {
                    bdData.set(`${p}:${k}`, v);
                },
            },
            DOM: {
                addStyle: (id, css) => bdStyles.set(id, css),
                removeStyle: id => bdStyles.delete(id),
            },
            Net: {
                fetch: async url => {
                    bdNetFetches++;
                    return {
                        ok: true,
                        status: 200,
                        json: async () => (String(url).includes("complex") ? complexJson : arJson),
                    };
                },
            },
            Webpack: {
                Filters: {
                    byKeys: (...keys) => mod => Boolean(mod) && keys.every(k => k in mod),
                },
                getByKeys: (...keys) => {
                    if (keys.includes("dispatch")) return fluxDispatcher;
                    if (keys.includes("parseTwoDigitYear")) return momentMod;
                    return undefined;
                },
                getStore: name => (name === "LocaleStore" ? localeStore : undefined),
                getModule: filter => [fluxDispatcher, momentMod, localeStore, intlObj].find(filter),
                waitForModule: () => Promise.resolve(undefined),
            },
            UI: {
                showToast: (text, opts) => bdToasts.push({ text, opts }),
            },
            Logger: { info() {}, warn() {}, error() {} },
            React: {
                Fragment: "Fragment",
                createElement: (type, props, ...children) => ({
                    type,
                    props: props || {},
                    children,
                }),
            },
        };

        const require = createRequire(import.meta.url);
        delete require.cache[bdPluginPath];
        const BdArabicDiscord = require(bdPluginPath);
        assert.equal(typeof BdArabicDiscord, "function");

        pluginInstance = new BdArabicDiscord();
        pluginInstance.start();
        await new Promise(r => setTimeout(r, 60));

        assert.ok(bdStyles.get("ArabicDiscord-styles")?.includes("data-arabic-rtl"));
        assert.equal(currentMomentLocale, "ar-discord");
        assert.equal(currentIntlLocale, "ar-u-nu-latn");
        assert.notEqual(discordUtils.createDateFormatter, origDateFormatter);
        assert.ok(bdNetFetches >= 2);

        const findEl = (node, attrName, attrVal) => {
            if (!node || typeof node !== "object") return null;
            if (node.getAttribute?.(attrName) === attrVal) return node;
            for (const child of node.children || []) {
                const hit = findEl(child, attrName, attrVal);
                if (hit) return hit;
            }
            return null;
        };

        const panel = pluginInstance.getSettingsPanel();
        const fontSelect = findEl(panel, "data-setting", "arabicFont");
        const scaleSlider = findEl(panel, "data-setting", "fontScale");
        const rtlSwitch = findEl(panel, "data-setting", "enableRtl");
        const updateBtn = findEl(panel, "data-action", "updateTranslations");

        assert.ok(fontSelect && fontSelect.children.length >= 13);
        assert.ok(scaleSlider && updateBtn && rtlSwitch);

        fontSelect.value = "tajawal";
        fontSelect.dispatch("change");
        assert.equal(rootAttrs.get("data-arabic-font"), "tajawal");

        scaleSlider.value = "110";
        scaleSlider.dispatch("input");
        assert.equal(rootStyle.get("--arabic-font-scale"), "110%");

        rtlSwitch.checked = true;
        rtlSwitch.dispatch("change");
        assert.equal(rootAttrs.get("data-arabic-rtl"), "1");
        assert.equal(rootAttrs.get("dir"), "rtl");
        assert.equal(bdData.get("ArabicDiscord:settings")?.enableRtl, true);

        const beforeClicks = bdNetFetches;
        updateBtn.click();
        await new Promise(r => setTimeout(r, 40));
        assert.ok(bdNetFetches >= beforeClicks + 2);

        pluginInstance.stop();
        assert.equal(bdStyles.has("ArabicDiscord-styles"), false);
        assert.equal(rootAttrs.has("data-arabic-rtl"), false);
        assert.equal(discordUtils.createDateFormatter, origDateFormatter);
        assert.equal(currentMomentLocale, "en");
        assert.equal(currentIntlLocale, "en-US");
    } finally {
        try {
            pluginInstance?.stop?.();
        } catch {
            // Ignore cleanup errors if test failed mid-setup
        }
        restoreGlobals();
    }
});
