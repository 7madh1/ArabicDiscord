/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const DB_NAME = "ArabicDiscordDB";
const STORE_NAME = "keyval";
const PLUGIN_NAME = "ArabicDiscord";
const STYLE_ID = "ArabicDiscord-styles";

function getBdApi() {
    return globalThis.BdApi;
}

function openDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("IndexedDB unavailable"));
            return;
        }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(STORE_NAME)) {
                req.result.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function idbOp(mode, fn) {
    return openDb().then(
        db =>
            new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, mode);
                const store = tx.objectStore(STORE_NAME);
                const result = fn(store);
                tx.oncomplete = () => resolve(result?._resolved);
                tx.onerror = () => reject(tx.error);
                if (result?.req) {
                    result.req.onsuccess = () => {
                        result._resolved = result.req.result;
                    };
                } else if (result?.reqs) {
                    Promise.all(
                        result.reqs.map(
                            r =>
                                new Promise((res, rej) => {
                                    r.onsuccess = () => res(r.result);
                                    r.onerror = () => rej(r.error);
                                }),
                        ),
                    )
                        .then(vals => {
                            result._resolved = vals;
                        })
                        .catch(reject);
                }
            }),
    );
}

export const DataStore = {
    async get(key) {
        try {
            return await idbOp("readonly", store => ({ req: store.get(key) }));
        } catch {
            return getBdApi()?.Data?.load?.(PLUGIN_NAME, String(key));
        }
    },
    async set(key, value) {
        try {
            await idbOp("readwrite", store => {
                store.put(value, key);
                return {};
            });
        } catch {
            getBdApi()?.Data?.save?.(PLUGIN_NAME, String(key), value);
        }
    },
    async getMany(keys) {
        try {
            return await idbOp("readonly", store => ({
                reqs: keys.map(k => store.get(k)),
            }));
        } catch {
            const BdApi = getBdApi();
            return keys.map(k => BdApi?.Data?.load?.(PLUGIN_NAME, String(k)));
        }
    },
    async setMany(entries) {
        try {
            await idbOp("readwrite", store => {
                for (const [k, v] of entries) {
                    store.put(v, k);
                }
                return {};
            });
        } catch {
            const BdApi = getBdApi();
            for (const [k, v] of entries) {
                BdApi?.Data?.save?.(PLUGIN_NAME, String(k), v);
            }
        }
    },
};

export let activeSettingsObject = null;

export function definePluginSettings(def) {
    const BdApi = getBdApi();
    const defaults = {};
    for (const [key, opt] of Object.entries(def)) {
        if ("default" in opt) {
            defaults[key] = opt.default;
        } else if (Array.isArray(opt.options)) {
            const found = opt.options.find(o => o.default);
            defaults[key] = found ? found.value : opt.options[0]?.value;
        }
    }

    const saved = BdApi?.Data?.load?.(PLUGIN_NAME, "settings") ?? {};
    const rawStore = { ...defaults, ...saved };

    const store = new Proxy(rawStore, {
        set(target, prop, value) {
            target[prop] = value;
            BdApi?.Data?.save?.(PLUGIN_NAME, "settings", { ...target });
            return true;
        },
    });

    activeSettingsObject = {
        def,
        store,
        use: () => store,
    };
    return activeSettingsObject;
}

export function enableStyle(cssText) {
    if (typeof cssText === "string" && cssText) {
        getBdApi()?.DOM?.addStyle?.(STYLE_ID, cssText);
    }
}

export function disableStyle() {
    getBdApi()?.DOM?.removeStyle?.(STYLE_ID);
}

let waitAbortController = null;

export function resetBdWaitControllers() {
    waitAbortController?.abort();
    waitAbortController = typeof AbortController === "function" ? new AbortController() : null;
}

export function abortBdWaitControllers() {
    waitAbortController?.abort();
    waitAbortController = null;
}

function toBdFilter(filter) {
    const BdApi = getBdApi();
    if (!BdApi?.Webpack) return null;
    if (typeof filter === "string") {
        return BdApi.Webpack.Filters.byKeys(filter);
    }
    if (Array.isArray(filter)) {
        return BdApi.Webpack.Filters.byKeys(...filter);
    }
    return filter;
}

export function find(filter) {
    const BdApi = getBdApi();
    const bdFilter = toBdFilter(filter);
    if (!BdApi?.Webpack || !bdFilter) return undefined;
    return BdApi.Webpack.getModule(bdFilter);
}

export function waitFor(filter, cb) {
    const BdApi = getBdApi();
    const bdFilter = toBdFilter(filter);
    if (!BdApi?.Webpack || !bdFilter) return;

    const existing = BdApi.Webpack.getModule(bdFilter);
    if (existing) {
        cb(existing);
        return;
    }

    const signal = waitAbortController?.signal;
    BdApi.Webpack.waitForModule(bdFilter, signal ? { signal } : undefined)
        ?.then(mod => {
            if (mod && !signal?.aborted) {
                cb(mod);
            }
        })
        .catch(() => {
            // Ignored when aborted on plugin stop()
        });
}

function createLazyWebpackProxy(resolver) {
    let cached = null;
    const resolve = () => {
        if (!cached) {
            cached = resolver() ?? null;
        }
        return cached;
    };
    return new Proxy(
        {},
        {
            get(_t, prop) {
                const target = resolve();
                return target ? Reflect.get(target, prop, target) : undefined;
            },
            has(_t, prop) {
                const target = resolve();
                return target ? prop in target : false;
            },
            ownKeys() {
                const target = resolve();
                return target ? Reflect.ownKeys(target) : [];
            },
        },
    );
}

export const FluxDispatcher = createLazyWebpackProxy(() =>
    getBdApi()?.Webpack?.getByKeys?.("dispatch", "subscribe"),
);

export const LocaleStore = createLazyWebpackProxy(() =>
    getBdApi()?.Webpack?.getStore?.("LocaleStore"),
);

export const moment = createLazyWebpackProxy(() =>
    getBdApi()?.Webpack?.getByKeys?.("parseTwoDigitYear"),
);

export const i18n = {
    get t() {
        return getBdApi()?.Webpack?.getModule?.(
            m => m?.[Symbol.toStringTag] === "IntlMessagesProxy",
        );
    },
    get intl() {
        return getBdApi()?.Webpack?.getModule?.(
            m => m != null && Object.getPrototypeOf(m)?.withFormatters != null,
        );
    },
};

export const Menu = {
    MenuItem: "MenuItem",
    MenuCheckboxItem: "MenuCheckboxItem",
};

export const React = new Proxy(
    {},
    {
        get(_t, prop) {
            const bdReact = getBdApi()?.React;
            if (bdReact && prop in bdReact) return bdReact[prop];
            if (prop === "Fragment") return "Fragment";
            if (prop === "createElement") {
                return (type, props, ...children) => ({
                    type,
                    props: props || {},
                    children,
                });
            }
            return undefined;
        },
    },
);

export function showToast(opts) {
    const BdApi = getBdApi();
    if (!BdApi?.UI?.showToast) return;
    if (typeof opts === "string") {
        BdApi.UI.showToast(opts, { type: "info" });
        return;
    }
    BdApi.UI.showToast(opts?.text ?? "", {
        type: opts?.variant === "critical" ? "error" : "success",
    });
}

export class Logger {
    constructor(name) {
        this.name = name;
    }
    info(...args) {
        getBdApi()?.Logger?.info?.(this.name, ...args);
    }
    warn(...args) {
        getBdApi()?.Logger?.warn?.(this.name, ...args);
    }
    error(...args) {
        getBdApi()?.Logger?.error?.(this.name, ...args);
    }
}

export function definePlugin(def) {
    return def;
}

export const OptionType = {
    SELECT: 0,
    SLIDER: 1,
    BOOLEAN: 2,
    COMPONENT: 3,
};

export const StartAt = {
    Init: "Init",
};

export const StubComponent = () => null;
