/**
 * @name ArabicDiscord
 * @author 7madh
 * @description Full Arabic localization for Discord with Arabic fonts and RTL layout support
 * @version 0.1.0
 * @source https://github.com/7madh1/ArabicDiscord
 * @updateUrl https://raw.githubusercontent.com/7madh1/ArabicDiscord/main/betterdiscord/ArabicDiscord.plugin.js
 */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/userplugins/arabicDiscord/betterdiscord/entry.mjs
var entry_exports = {};
__export(entry_exports, {
  default: () => ArabicDiscord
});
module.exports = __toCommonJS(entry_exports);

// src/userplugins/arabicDiscord/betterdiscord/fetch-shim.mjs
async function fetch(input, init) {
  if (init?.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const url = typeof input === "string" ? input : input?.url;
  const bdNet = globalThis.BdApi?.Net;
  if (typeof url === "string" && url.startsWith("https://raw.githubusercontent.com/") && typeof bdNet?.fetch === "function") {
    const res = await bdNet.fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.headers
    });
    if (init?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    return {
      ok: res.ok ?? (res.status >= 200 && res.status < 300),
      status: res.status ?? 200,
      json: async () => typeof res.json === "function" ? res.json() : JSON.parse(await res.text())
    };
  }
  return globalThis.fetch(input, init);
}

// src/userplugins/arabicDiscord/betterdiscord/shims.mjs
var DB_NAME = "ArabicDiscordDB";
var STORE_NAME = "keyval";
var PLUGIN_NAME = "ArabicDiscord";
var STYLE_ID = "ArabicDiscord-styles";
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
    (db) => new Promise((resolve, reject) => {
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
            (r) => new Promise((res, rej) => {
              r.onsuccess = () => res(r.result);
              r.onerror = () => rej(r.error);
            })
          )
        ).then((vals) => {
          result._resolved = vals;
        }).catch(reject);
      }
    })
  );
}
var DataStore = {
  async get(key) {
    try {
      return await idbOp("readonly", (store) => ({ req: store.get(key) }));
    } catch {
      return getBdApi()?.Data?.load?.(PLUGIN_NAME, String(key));
    }
  },
  async set(key, value) {
    try {
      await idbOp("readwrite", (store) => {
        store.put(value, key);
        return {};
      });
    } catch {
      getBdApi()?.Data?.save?.(PLUGIN_NAME, String(key), value);
    }
  },
  async getMany(keys) {
    try {
      return await idbOp("readonly", (store) => ({
        reqs: keys.map((k) => store.get(k))
      }));
    } catch {
      const BdApi = getBdApi();
      return keys.map((k) => BdApi?.Data?.load?.(PLUGIN_NAME, String(k)));
    }
  },
  async setMany(entries) {
    try {
      await idbOp("readwrite", (store) => {
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
  }
};
var activeSettingsObject = null;
function definePluginSettings(def) {
  const BdApi = getBdApi();
  const defaults = {};
  for (const [key, opt] of Object.entries(def)) {
    if ("default" in opt) {
      defaults[key] = opt.default;
    } else if (Array.isArray(opt.options)) {
      const found = opt.options.find((o) => o.default);
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
    }
  });
  activeSettingsObject = {
    def,
    store,
    use: () => store
  };
  return activeSettingsObject;
}
function enableStyle(cssText) {
  if (typeof cssText === "string" && cssText) {
    getBdApi()?.DOM?.addStyle?.(STYLE_ID, cssText);
  }
}
function disableStyle() {
  getBdApi()?.DOM?.removeStyle?.(STYLE_ID);
}
var waitAbortController = null;
function resetBdWaitControllers() {
  waitAbortController?.abort();
  waitAbortController = typeof AbortController === "function" ? new AbortController() : null;
}
function abortBdWaitControllers() {
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
function find(filter) {
  const BdApi = getBdApi();
  const bdFilter = toBdFilter(filter);
  if (!BdApi?.Webpack || !bdFilter) return void 0;
  return BdApi.Webpack.getModule(bdFilter);
}
function waitFor(filter, cb) {
  const BdApi = getBdApi();
  const bdFilter = toBdFilter(filter);
  if (!BdApi?.Webpack || !bdFilter) return;
  const existing = BdApi.Webpack.getModule(bdFilter);
  if (existing) {
    cb(existing);
    return;
  }
  const signal = waitAbortController?.signal;
  BdApi.Webpack.waitForModule(bdFilter, signal ? { signal } : void 0)?.then((mod) => {
    if (mod && !signal?.aborted) {
      cb(mod);
    }
  }).catch(() => {
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
        return target ? Reflect.get(target, prop, target) : void 0;
      },
      has(_t, prop) {
        const target = resolve();
        return target ? prop in target : false;
      },
      ownKeys() {
        const target = resolve();
        return target ? Reflect.ownKeys(target) : [];
      }
    }
  );
}
var FluxDispatcher = createLazyWebpackProxy(
  () => getBdApi()?.Webpack?.getByKeys?.("dispatch", "subscribe")
);
var LocaleStore = createLazyWebpackProxy(
  () => getBdApi()?.Webpack?.getStore?.("LocaleStore")
);
var moment = createLazyWebpackProxy(
  () => getBdApi()?.Webpack?.getByKeys?.("parseTwoDigitYear")
);
var i18n = {
  get t() {
    return getBdApi()?.Webpack?.getModule?.(
      (m) => m?.[Symbol.toStringTag] === "IntlMessagesProxy"
    );
  },
  get intl() {
    return getBdApi()?.Webpack?.getModule?.(
      (m) => m != null && Object.getPrototypeOf(m)?.withFormatters != null
    );
  }
};
var Menu = {
  MenuItem: "MenuItem",
  MenuCheckboxItem: "MenuCheckboxItem"
};
var React = new Proxy(
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
          children
        });
      }
      return void 0;
    }
  }
);
function showToast(opts) {
  const BdApi = getBdApi();
  if (!BdApi?.UI?.showToast) return;
  if (typeof opts === "string") {
    BdApi.UI.showToast(opts, { type: "info" });
    return;
  }
  BdApi.UI.showToast(opts?.text ?? "", {
    type: opts?.variant === "critical" ? "error" : "success"
  });
}
var Logger = class {
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
};
function definePlugin(def) {
  return def;
}
var OptionType = {
  SELECT: 0,
  SLIDER: 1,
  BOOLEAN: 2,
  COMPONENT: 3
};
var StartAt = {
  Init: "Init"
};
var StubComponent = () => null;

// bd-shim:@api/DataStore
var { get, set, getMany, setMany } = DataStore;

// node_modules/.pnpm/@intrnl+xxhash64@0.1.2/node_modules/@intrnl/xxhash64/src/index.js
var PRIME64_1 = 11400714785074694791n;
var PRIME64_2 = 14029467366897019727n;
var PRIME64_3 = 1609587929392839161n;
var PRIME64_4 = 9650029242287828579n;
var PRIME64_5 = 2870177450012600261n;
var BITS = 64n;
var BITMASK = 2n ** BITS - 1n;
var encoder = new TextEncoder();
function bitsToBigInt(a00, a16, a32, a48) {
  return BigInt(a00) | BigInt(a16) << 16n | BigInt(a32) << 32n | BigInt(a48) << 48n;
}
function memoryToBigInt(memory, offset) {
  return BigInt(memory[offset]) | BigInt(memory[offset + 1]) << 8n | BigInt(memory[offset + 2]) << 16n | BigInt(memory[offset + 3]) << 24n | BigInt(memory[offset + 4]) << 32n | BigInt(memory[offset + 5]) << 40n | BigInt(memory[offset + 6]) << 48n | BigInt(memory[offset + 7]) << 56n;
}
function rotl(value, rotation) {
  return value << rotation & BITMASK | value >> BITS - rotation;
}
function trunc(value) {
  return BigInt.asUintN(64, value);
}
var XXH64 = class {
  #seed;
  #v1;
  #v2;
  #v3;
  #v4;
  #memory;
  #len;
  #memsize;
  constructor(seed = 0) {
    this.reset(seed);
  }
  reset(seed = this.#seed) {
    this.#seed = BigInt.asUintN(32, BigInt(seed));
    this.#v1 = trunc(this.#seed + PRIME64_1 + PRIME64_2);
    this.#v2 = trunc(this.#seed + PRIME64_2);
    this.#v3 = this.#seed;
    this.#v4 = trunc(this.#seed - PRIME64_1);
    this.#memory = null;
    this.#len = 0;
    this.#memsize = 0;
    return this;
  }
  update(input) {
    if (typeof input === "string") {
      input = encoder.encode(input);
    }
    let p = 0;
    let len = input.length;
    let bEnd = p + len;
    if (len === 0) {
      return this;
    }
    this.#len += len;
    if (this.#memsize === 0) {
      this.#memory = new Uint8Array(32);
    }
    if (this.#memsize + len < 32) {
      this.#memory.set(input.subarray(0, len), this.#memsize);
      this.#memsize += len;
      return this;
    }
    if (this.#memsize > 0) {
      this.#memory.set(input.subarray(0, 32 - this.#memsize), this.#memsize);
      let p64 = 0;
      let other;
      other = memoryToBigInt(this.#memory, p64);
      this.#v1 = trunc(rotl(trunc(this.#v1 + other * PRIME64_2), 31n) * PRIME64_1);
      p64 += 8;
      other = memoryToBigInt(this.memory, p64);
      this.#v2 = trunc(rotl(trunc(this.#v2 + other * PRIME64_2), 31n) * PRIME64_1);
      p64 += 8;
      other = memoryToBigInt(this.memory, p64);
      this.#v3 = trunc(rotl(trunc(this.#v3 + other * PRIME64_2), 31n) * PRIME64_1);
      p64 += 8;
      other = memoryToBigInt(this.memory, p64);
      this.#v4 = trunc(rotl(trunc(this.#v4 + other * PRIME64_2), 31n) * PRIME64_1);
      p += 32 - this.#memsize;
      this.#memsize = 0;
    }
    if (p <= bEnd - 32) {
      const limit = bEnd - 32;
      do {
        let other;
        other = memoryToBigInt(input, p);
        this.#v1 = trunc(rotl(trunc(this.#v1 + other * PRIME64_2), 31n) * PRIME64_1);
        p += 8;
        other = memoryToBigInt(input, p);
        this.#v2 = trunc(rotl(trunc(this.#v2 + other * PRIME64_2), 31n) * PRIME64_1);
        p += 8;
        other = memoryToBigInt(input, p);
        this.#v3 = trunc(rotl(trunc(this.#v3 + other * PRIME64_2), 31n) * PRIME64_1);
        p += 8;
        other = memoryToBigInt(input, p);
        this.#v4 = trunc(rotl(trunc(this.#v4 + other * PRIME64_2), 31n) * PRIME64_1);
        p += 8;
      } while (p <= limit);
    }
    if (p < bEnd) {
      this.#memory.set(input.subarray(p, bEnd), this.#memsize);
      this.#memsize = bEnd - p;
    }
    return this;
  }
  digest() {
    let input = this.#memory;
    let bEnd = this.#memsize;
    let p = 0;
    let h64 = 0n;
    let h = 0n;
    let u = 0n;
    if (this.#len >= 32) {
      h64 = rotl(this.#v1, 1n) + rotl(this.#v2, 7n) + rotl(this.#v3, 12n) + rotl(this.#v4, 18n);
      h64 = trunc(h64 ^ rotl(trunc(this.#v1 * PRIME64_2), 31n) * PRIME64_1);
      h64 = trunc(h64 * PRIME64_1 + PRIME64_4);
      h64 = trunc(h64 ^ rotl(trunc(this.#v2 * PRIME64_2), 31n) * PRIME64_1);
      h64 = trunc(h64 * PRIME64_1 + PRIME64_4);
      h64 = trunc(h64 ^ rotl(trunc(this.#v3 * PRIME64_2), 31n) * PRIME64_1);
      h64 = trunc(h64 * PRIME64_1 + PRIME64_4);
      h64 = trunc(h64 ^ rotl(trunc(this.#v4 * PRIME64_2), 31n) * PRIME64_1);
      h64 = trunc(h64 * PRIME64_1 + PRIME64_4);
    } else {
      h64 = trunc(this.#seed + PRIME64_5);
    }
    h64 += BigInt(this.#len);
    while (p <= bEnd - 8) {
      u = memoryToBigInt(input, p);
      u = trunc(rotl(trunc(u * PRIME64_2), 31n) * PRIME64_1);
      h64 = trunc(rotl(h64 ^ u, 27n) * PRIME64_1 + PRIME64_4);
      p += 8;
    }
    if (p + 4 <= bEnd) {
      u = bitsToBigInt(input[p + 1] << 8 | input[p], input[p + 3] << 8 | input[p + 2], 0, 0);
      h64 = trunc(rotl(h64 ^ trunc(u * PRIME64_1), 23n) * PRIME64_2 + PRIME64_3);
      p += 4;
    }
    while (p < bEnd) {
      u = bitsToBigInt(input[p++], 0, 0, 0);
      h64 = trunc(rotl(h64 ^ trunc(u * PRIME64_5), 11n) * PRIME64_1);
    }
    h = trunc(h64 >> 33n);
    h64 = trunc((h64 ^ h) * PRIME64_2);
    h = trunc(h64 >> 29n);
    h64 = trunc((h64 ^ h) * PRIME64_3);
    h = trunc(h64 >> 32n);
    h64 = trunc(h64 ^ h);
    return h64;
  }
};
function hash(input, seed = 0) {
  return new XXH64(seed).update(input).digest();
}

// src/utils/intlHash.ts
var BASE64_TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
var IS_BIG_ENDIAN = (() => {
  const array = new Uint8Array(4);
  const view = new Uint32Array(array.buffer);
  return !((view[0] = 1) & array[0]);
})();
function numberToBytes(number) {
  number = BigInt(number);
  const array = [];
  const byteCount = Math.ceil(Math.floor(Math.log2(Number(number)) + 1) / 8);
  for (let i = 0; i < byteCount; i++) {
    array.unshift(Number(number >> BigInt(8 * i) & BigInt(255)));
  }
  const bytes = new Uint8Array(array);
  return IS_BIG_ENDIAN ? bytes : bytes.reverse();
}
function runtimeHashMessageKey(key) {
  const hash2 = hash(key, 0);
  const bytes = numberToBytes(hash2);
  return [
    BASE64_TABLE[bytes[0] >> 2],
    BASE64_TABLE[(bytes[0] & 3) << 4 | bytes[1] >> 4],
    BASE64_TABLE[(bytes[1] & 15) << 2 | bytes[2] >> 6],
    BASE64_TABLE[bytes[2] & 63],
    BASE64_TABLE[bytes[3] >> 2],
    BASE64_TABLE[(bytes[3] & 3) << 4 | bytes[4] >> 4]
  ].join("");
}

// bd-css-text:styles.css
var styles_default = 'html[data-arabic-font] {\n    --font-primary: var(--arabic-font-stack) !important;\n    --font-display: var(--arabic-font-stack) !important;\n    --font-headline: var(--arabic-font-stack) !important;\n}\n\nhtml[data-arabic-font] body,\nhtml[data-arabic-font] button,\nhtml[data-arabic-font] input,\nhtml[data-arabic-font] textarea,\nhtml[data-arabic-font] select {\n    font-family: var(--arabic-font-stack) !important;\n}\n\n/* \u062A\u0639\u062F\u064A\u0644 \u062D\u062C\u0645 \u0627\u0644\u062E\u0637 \u0627\u0644\u0639\u0627\u0645 \u0644\u0644\u0648\u0627\u062C\u0647\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0639\u0646\u062F \u062A\u063A\u064A\u064A\u0631\u0647 \u0639\u0646 100% */\nhtml[data-arabic-scale-active] {\n    font-size: var(--arabic-font-scale) !important;\n}\n\n/* \u0645\u0646\u0639 \u062A\u0642\u0637\u0639 \u062D\u0631\u0648\u0641 \u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0628\u0633\u0628\u0628 \u062A\u0628\u0627\u0639\u062F \u0627\u0644\u0623\u062D\u0631\u0641 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A \u0641\u064A \u062F\u064A\u0633\u0643\u0648\u0631\u062F */\nhtml[data-arabic-font] :not(pre, code, kbd, [class*="codeBlockText_"], [class*="inlineCode_"]) {\n    letter-spacing: 0 !important;\n}\n\n/* \u0645\u062D\u0627\u0630\u0627\u0629 \u0627\u0644\u0633\u064A\u0631 \u0627\u0644\u0630\u0627\u062A\u064A\u0629 \u0648\u0627\u0644\u0640 embeds \u0645\u0639 \u0625\u0628\u0642\u0627\u0621 \u0646\u0635\u0648\u0635 \u0627\u0644\u0634\u0627\u062A \u0645\u062A\u0633\u0642\u0629 \u0641\u064A \u0648\u0636\u0639 RTL */\nhtml[data-arabic-rtl="1"] [class*="embedTitle_"],\nhtml[data-arabic-rtl="1"] [class*="embedDescription_"],\nhtml[data-arabic-rtl="1"] [class*="descriptionClamp_"],\nhtml[data-arabic-rtl="1"] [class*="descriptionClamp_"] [class*="markup_"],\nhtml[data-arabic-rtl="1"] [class*="userPopout"] [class*="markup_"],\nhtml[data-arabic-rtl="1"] [class*="userProfile"] [class*="markup_"] {\n    unicode-bidi: plaintext;\n    text-align: start !important;\n}\n\n/* \u062A\u062B\u0628\u064A\u062A \u0627\u062A\u062C\u0627\u0647 \u0646\u0635\u0648\u0635 Placeholder (\u0645\u062B\u0644 \u0627\u0644\u0628\u062D\u062B \u0648\u0635\u0646\u062F\u0648\u0642 \u0627\u0644\u0631\u0633\u0627\u0626\u0644) \u0645\u0646 \u0627\u0644\u064A\u0645\u064A\u0646 \u062D\u062A\u0649 \u0644\u0648 \u0628\u062F\u0623\u062A \u0623\u0648 \u0627\u062D\u062A\u0648\u062A \u0623\u0633\u0645\u0627\u0621 \u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 */\nhtml[data-arabic-rtl="1"] [class*="placeholder_"],\nhtml[data-arabic-rtl="1"] .public-DraftEditorPlaceholder-inner {\n    direction: rtl !important;\n    unicode-bidi: isolate !important;\n    text-align: start !important;\n}\n\n/* \u0645\u0646\u0639 \u0627\u0646\u0639\u0643\u0627\u0633 \u0627\u0644\u0631\u0645\u0648\u0632 \u0648\u0627\u0644\u0634\u0631\u0637\u0627\u062A \u0648\u0627\u0644\u0623\u0642\u0648\u0627\u0633 \u0641\u064A \u0623\u0633\u0645\u0627\u0621 \u0627\u0644\u0642\u0646\u0648\u0627\u062A \u0648\u0627\u0644\u0641\u0626\u0627\u062A \u0648\u0627\u0644\u0623\u0639\u0636\u0627\u0621 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0645\u0639 \u0625\u0628\u0642\u0627\u0626\u0647\u0627 \u0645\u062D\u0627\u0630\u064A\u0629 \u0644\u0644\u064A\u0645\u064A\u0646 */\nhtml[data-arabic-rtl="1"] [class*="linkTop_"] [class*="name_"],\nhtml[data-arabic-rtl="1"] [class*="basicChannelRowLink_"] [class*="name_"],\nhtml[data-arabic-rtl="1"] [class*="wrapperCommon_"] [class*="mainContent_"] [class*="name_"],\nhtml[data-arabic-rtl="1"] [class*="titleWrapper_"] [class*="title_"],\nhtml[data-arabic-rtl="1"] [class*="privateChannels_"] [class*="name_"],\nhtml[data-arabic-rtl="1"] [class*="privateChannels_"] [class*="name_"] span,\nhtml[data-arabic-rtl="1"] [class*="members_"] [class*="name_"],\nhtml[data-arabic-rtl="1"] [class*="members_"] [class*="name_"] span,\nhtml[data-arabic-rtl="1"] [class*="members_"] [class*="username_"],\nhtml[data-arabic-rtl="1"] [class*="members_"] [class*="username_"] > *,\nhtml[data-arabic-rtl="1"] [class*="members_"] [class*="membersGroupName_"] {\n    unicode-bidi: plaintext !important;\n    text-align: right !important;\n}\n\n/* \u0636\u0645\u0627\u0646 \u0627\u0642\u062A\u0635\u0627\u0635 \u0646\u0635\u0648\u0635 \u0627\u0644\u062D\u0627\u0644\u0627\u062A \u0648\u0627\u0644\u0623\u0646\u0634\u0637\u0629 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0627\u0644\u0637\u0648\u064A\u0644\u0629 \u0645\u0646 \u0646\u0647\u0627\u064A\u062A\u0647\u0627 (...) \u0628\u062F\u0644 \u0628\u062F\u0627\u064A\u062A\u0647\u0627 \u0641\u064A \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0639\u0636\u0627\u0621 \u0648\u0627\u0644\u0640 DM */\nhtml[data-arabic-rtl="1"] [class*="truncated_HigqCD"],\nhtml[data-arabic-rtl="1"] [class*="subtext_yc3axZ"],\nhtml[data-arabic-rtl="1"] [class*="activityStatusText_zln_tS"],\nhtml[data-arabic-rtl="1"] [class*="subtext_zln_tS"],\nhtml[data-arabic-rtl="1"] [class*="gameName_UQqFnR"],\nhtml[data-arabic-rtl="1"] [class*="membersGroupName_"],\nhtml[data-arabic-rtl="1"] [class*="clipTitle_"] {\n    text-align: right !important;\n    unicode-bidi: plaintext !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="cozy_"] [class*="markupRtl_"],\nhtml[data-arabic-rtl="1"]\n    [class*="cozy_"]\n    [class*="messageContent_"]:not([class*="repliedTextContent_"]) {\n    unicode-bidi: isolate;\n    text-align: start !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="messageContent_"]:not([class*="repliedTextContent_"]) {\n    display: block;\n    width: 100%;\n}\n\n/* \u062A\u062D\u0633\u064A\u0646 \u0639\u0644\u0627\u0645\u0627\u062A \u0627\u0644\u062A\u0631\u0642\u064A\u0645 \u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0625\u062F\u062E\u0627\u0644 \u0641\u0642\u0637 \u062F\u0648\u0646 \u062A\u063A\u064A\u064A\u0631 \u0645\u062D\u0627\u0630\u0627\u0629 \u0627\u0644\u0639\u0646\u0627\u0648\u064A\u0646 \u0648\u0627\u0644\u0623\u0633\u0645\u0627\u0621 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 */\nhtml[data-arabic-font] input,\nhtml[data-arabic-font] textarea {\n    unicode-bidi: plaintext;\n}\n\n/* ==========================================================================\n * \u0648\u0636\u0639 RTL \u0627\u0644\u0623\u0635\u0644\u064A \u0627\u0644\u0645\u0639\u062A\u0645\u062F \u0639\u0644\u0649 \u0627\u0644\u062E\u0635\u0627\u0626\u0635 \u0627\u0644\u0645\u0646\u0637\u0642\u064A\u0629 (CSS Logical Properties)\n * \u062F\u064A\u0633\u0643\u0648\u0631\u062F \u064A\u0639\u062A\u0645\u062F \u062F\u0627\u062E\u0644\u064A\u0627\u064B \u0639\u0644\u0649 margin-inline / padding-inline / inset-inline\n * \u0641\u064A \u0623\u063A\u0644\u0628 \u0627\u0644\u0645\u0643\u0648\u0646\u0627\u062A (\u0627\u0644\u0631\u0633\u0627\u0626\u0644\u060C \u062E\u0637 \u0627\u0644\u0631\u062F\u0648\u062F\u060C \u0627\u0644\u0623\u0641\u0627\u062A\u0627\u0631\u060C \u0627\u0644\u0623\u0634\u0631\u0637\u0629)\u060C \u0644\u0630\u0627 \u0646\u062A\u0631\u0643 \u0644\u0647\n * \u062D\u0633\u0627\u0628\u0627\u062A\u0647 \u0627\u0644\u0645\u0646\u0637\u0642\u064A\u0629 \u0648\u0646\u0635\u0644\u062D \u0641\u0642\u0637 \u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0641\u064A\u0632\u064A\u0627\u0626\u064A\u0629 \u0627\u0644\u0645\u062A\u0628\u0642\u064A\u0629 \u0641\u064A \u062F\u064A\u0633\u0643\u0648\u0631\u062F \u0648Vencord.\n * ========================================================================== */\nhtml[data-arabic-rtl="1"],\nhtml[data-arabic-rtl="1"] body,\nhtml[data-arabic-rtl="1"] #app-mount,\nhtml[data-arabic-rtl="1"] [class*="app_"],\nhtml[data-arabic-rtl="1"] [class*="layers_"],\nhtml[data-arabic-rtl="1"] [class*="layer_"],\nhtml[data-arabic-rtl="1"] [class*="base_"],\nhtml[data-arabic-rtl="1"] [class*="chat_"],\nhtml[data-arabic-rtl="1"] [class*="chatContent_"],\nhtml[data-arabic-rtl="1"] [class*="messagesWrapper_"],\nhtml[data-arabic-rtl="1"] [class*="messagesWrapper_"] [class*="scroller_"],\nhtml[data-arabic-rtl="1"] [class*="messagesWrapper_"] [class*="scrollerInner_"],\nhtml[data-arabic-rtl="1"] [class*="messageListItem_"],\nhtml[data-arabic-rtl="1"] [class*="cozyMessage_"],\nhtml[data-arabic-rtl="1"] [class*="cozy_"],\nhtml[data-arabic-rtl="1"] [class*="compact_"],\nhtml[data-arabic-rtl="1"] [class*="repliedMessage_"],\nhtml[data-arabic-rtl="1"] [class*="tabBody_"],\nhtml[data-arabic-rtl="1"] [class*="peopleColumn_"],\nhtml[data-arabic-rtl="1"] [class*="peopleList_"],\nhtml[data-arabic-rtl="1"] [class*="peopleListItem_"],\nhtml[data-arabic-rtl="1"] [class*="rowContent_"],\nhtml[data-arabic-rtl="1"] [class*="listItemContents_"],\nhtml[data-arabic-rtl="1"] [class*="userInfo_"],\nhtml[data-arabic-rtl="1"] [class*="sectionTitle_"],\nhtml[data-arabic-rtl="1"] [class*="emptyStateContainer_"],\nhtml[data-arabic-rtl="1"] [class*="nowPlayingColumn_"],\nhtml[data-arabic-rtl="1"] [class*="nowPlayingScroller_"],\nhtml[data-arabic-rtl="1"] [class*="nowPlayingCard_"],\nhtml[data-arabic-rtl="1"] [class*="emptyCard_"],\nhtml[data-arabic-rtl="1"] [class*="scrollerBase_"],\nhtml[data-arabic-rtl="1"] [class*="privateChannels_"],\nhtml[data-arabic-rtl="1"] [class*="members_"],\nhtml[data-arabic-rtl="1"] [class*="membersWrap_"],\nhtml[data-arabic-rtl="1"] [role="list"],\nhtml[data-arabic-rtl="1"] [role="listitem"],\nhtml[data-arabic-rtl="1"]\n    [dir="ltr"]:not(pre):not(code):not(kbd):not(.katex):not([role="slider"]):not(\n        [class*="slider_"]\n    ):not([class*="titleBar_"]):not([class*="winButtons_"]):not([class*="mediaBar"]):not(\n        [class*="keybindShortcut_"]\n    ):not([class*="keyComboInner_"]):not([class*="codeBlockText_"]):not([class*="inlineCode_"]):not(\n        [class*="timestamp_"]\n    ):not(time):not([class*="numberBadge_"]):not([class*="mentionsBadge_"]):not(\n        .vc-switch-container\n    ):not([class*="markup_"]):not([class*="animatedEmoji_"]):not([class*="clip_2LrOmL"]):not(\n        [class*="follow_LRYSOg"]\n    ) {\n    direction: rtl !important;\n}\n\n/* \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0635\u062F\u0642\u0627\u0621 \u0648\u0646\u0634\u0637 \u0627\u0644\u0622\u0646: \u0627\u0644\u0635\u0648\u0631\u0629 \u0648\u0627\u0644\u0627\u0633\u0645 \u0639\u0644\u0649 \u0627\u0644\u064A\u0645\u064A\u0646 \u0648\u0623\u0632\u0631\u0627\u0631 \u0627\u0644\u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u064A\u0633\u0627\u0631 */\nhtml[data-arabic-rtl="1"] [class*="peopleListItem_"] [class*="listItemContents_"],\nhtml[data-arabic-rtl="1"] [class*="peopleListItem_"] [class*="userInfo_"] {\n    direction: rtl !important;\n    text-align: start !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="peopleListItem_"] [class*="text_"],\nhtml[data-arabic-rtl="1"] [class*="peopleListItem_"] [class*="subtext_"],\nhtml[data-arabic-rtl="1"] [class*="peopleList_"] [class*="title_"],\nhtml[data-arabic-rtl="1"] [class*="sectionTitle_"] [class*="title_"] {\n    direction: rtl !important;\n    unicode-bidi: isolate !important;\n    text-align: start !important;\n    align-items: flex-start !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="peopleListItem_"] [class*="discordTag_"] {\n    direction: rtl !important;\n    justify-content: flex-start !important;\n    align-items: center !important;\n    text-align: start !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="emptyCard_"],\nhtml[data-arabic-rtl="1"] [class*="emptyCard_"] [class*="emptyHeader_"],\nhtml[data-arabic-rtl="1"] [class*="emptyCard_"] [class*="emptyText_"],\nhtml[data-arabic-rtl="1"] [class*="emptyStateContainer_"] [class*="title_"],\nhtml[data-arabic-rtl="1"] [class*="emptyStateContainer_"] [class*="text_"] {\n    direction: rtl !important;\n    unicode-bidi: isolate !important;\n    text-align: center !important;\n}\n\n/* \u0636\u0645\u0627\u0646 \u0648\u0636\u0639 \u0635\u0648\u0631\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0648\u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0639\u0644\u0649 \u0627\u0644\u064A\u0645\u064A\u0646 \u0648\u062A\u0648\u0627\u0641\u0642 \u0627\u0644\u062E\u0635\u0627\u0626\u0635 \u0627\u0644\u0645\u0646\u0637\u0642\u064A\u0629 \u0648\u0627\u0644\u0641\u064A\u0632\u064A\u0627\u0626\u064A\u0629 \u0645\u0639\u0627\u064B */\nhtml[data-arabic-rtl="1"]\n    [class*="cozy_"][class*="wrapper_"]:not([class*="contentOnly_"]):not([class*="preview_"]) {\n    padding-left: var(--custom-message-margin-horizontal, 16px) !important;\n    padding-right: var(--custom-message-margin-left-content-cozy, 72px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="cozy_"] [class*="avatar_"] {\n    left: auto !important;\n    right: var(--custom-message-margin-horizontal, 16px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="cozy_"] [class*="avatarDecoration_"] {\n    left: auto !important;\n    right: calc(\n        var(--custom-message-margin-horizontal, 16px) -\n            (\n                var(--custom-message-avatar-decoration-size, 48px) -\n                    var(--custom-message-avatar-size, 40px)\n            ) /\n            2\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="cozy_"] [class*="header_"],\nhtml[data-arabic-rtl="1"] [class*="cozy_"] [class*="contents_"] {\n    margin-left: 0 !important;\n    padding-left: 0 !important;\n    text-align: start !important;\n    unicode-bidi: isolate;\n}\n\n/* \u0639\u0643\u0633 \u062B\u0642\u0628 \u0635\u0648\u0631\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 (Cutout) \u0641\u064A \u0628\u0627\u0646\u0631 \u0627\u0644\u0628\u0631\u0648\u0641\u0627\u064A\u0644 \u0644\u064A\u0643\u0648\u0646 \u062E\u0644\u0641 \u0627\u0644\u0635\u0648\u0631\u0629 \u0639\u0644\u0649 \u0627\u0644\u064A\u0645\u064A\u0646 \u0641\u064A RTL */\nhtml[data-arabic-rtl="1"] [style*="--custom-cutout-x"] [class*="fill_"],\nhtml[data-arabic-rtl="1"] [class*="fill_"][style*="--custom-cutout-x"] {\n    -webkit-mask-image: radial-gradient(\n        circle var(--custom-cutout-radius) at calc(100% - var(--custom-cutout-x))\n            var(--custom-cutout-y),\n        transparent 0,\n        transparent calc(var(--custom-cutout-radius) - 0.5px),\n        #000 var(--custom-cutout-radius)\n    ) !important;\n    mask-image: radial-gradient(\n        circle var(--custom-cutout-radius) at calc(100% - var(--custom-cutout-x))\n            var(--custom-cutout-y),\n        transparent 0,\n        transparent calc(var(--custom-cutout-radius) - 0.5px),\n        #000 var(--custom-cutout-radius)\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"]\n    [class*="cozy_"]\n    [class*="messageContent_"]:not([class*="repliedTextContent_"]) {\n    margin-left: 0 !important;\n    padding-left: 0 !important;\n    margin-right: calc(var(--custom-message-margin-left-content-cozy, 72px) * -1) !important;\n    padding-right: var(--custom-message-margin-left-content-cozy, 72px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="messageListItem_"] [class*="buttonContainer_"],\nhtml[data-arabic-rtl="1"] [class*="cozy_"] > [class*="buttonContainer_"] {\n    right: auto !important;\n    left: 0 !important;\n}\n\n:where(html[data-arabic-rtl="1"] h1),\n:where(html[data-arabic-rtl="1"] h2),\n:where(html[data-arabic-rtl="1"] h3),\n:where(html[data-arabic-rtl="1"] p),\n:where(html[data-arabic-rtl="1"] label),\n:where(html[data-arabic-rtl="1"] [class*="vc-"]) {\n    text-align: start;\n}\n\n/* \u062A\u0648\u0633\u064A\u0637 \u0646\u0635\u0648\u0635 \u0648\u0639\u0646\u0627\u0648\u064A\u0646 \u062A\u0644\u0645\u064A\u062D\u0627\u062A \u0627\u0644\u0634\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0637\u0648\u0651\u0631\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0641\u064A RTL */\nhtml[data-arabic-rtl="1"] [class*="content_2dzrtJ"] [class*="titleGroup_"],\nhtml[data-arabic-rtl="1"] [class*="content_2dzrtJ"] [class*="title_"],\nhtml[data-arabic-rtl="1"] [class*="content_2dzrtJ"] [class*="eyebrow_"],\nhtml[data-arabic-rtl="1"] [class*="content_2dzrtJ"] [class*="body_"] {\n    width: 100% !important;\n    text-align: center !important;\n}\n\n/* \u0639\u0643\u0633 \u0645\u0624\u0634\u0631 \u0627\u0644\u0642\u0646\u0648\u0627\u062A \u0648\u0627\u0644\u0633\u064A\u0631\u0641\u0631\u0627\u062A \u063A\u064A\u0631 \u0627\u0644\u0645\u0642\u0631\u0648\u0621\u0629 (\u0627\u0644\u0646\u0642\u0637\u0629/\u0627\u0644\u0634\u0631\u064A\u0637 \u0639\u0644\u0649 \u0627\u0644\u062D\u0627\u0641\u0629 \u0627\u0644\u064A\u0645\u0646\u0649) */\nhtml[data-arabic-rtl="1"] [class*="guilds_"],\nhtml[data-arabic-rtl="1"] [data-list-id="guildsnav"],\nhtml[data-arabic-rtl="1"] [data-list-id="guildsnav"] [class*="listItem_"] {\n    direction: rtl !important;\n}\n\nhtml[data-arabic-rtl="1"] [data-list-id="guildsnav"] [class*="pill_"],\nhtml[data-arabic-rtl="1"] [data-list-id="guildsnav"] [class*="overlay__o8_Xq"] {\n    inset-inline-start: auto !important;\n    inset-inline-end: auto !important;\n    left: auto !important;\n    right: 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [data-list-id="guildsnav"] [class*="pill_"] span,\nhtml[data-arabic-rtl="1"]\n    [data-list-id="guildsnav"]\n    [class*="wrapper_"]\n    > [class*="item_"]:not([class*="expandedFolder"]),\nhtml[data-arabic-rtl="1"] [data-list-id="guildsnav"] [class*="item__o8_Xq"] {\n    border-radius: 4px 0 0 4px !important;\n}\n\nhtml[data-arabic-rtl="1"]\n    [data-list-id="guildsnav"]\n    [class*="small__o8_Xq"]\n    [class*="item__o8_Xq"] {\n    border-radius: var(--radius-round, 999px) 0 0 var(--radius-round, 999px) !important;\n}\n\nhtml[data-arabic-rtl="1"]\n    [data-list-id="guildsnav"]\n    [class*="item__o8_Xq"]:not([class*="visible__o8_Xq"]) {\n    transform: translateX(4px) translateZ(0) !important;\n}\n\nhtml[data-arabic-rtl="1"] [data-list-id="guildsnav"] [class*="pill_"] span,\nhtml[data-arabic-rtl="1"] [data-list-id="guildsnav"] [class*="item__o8_Xq"] {\n    margin-left: 0 !important;\n    margin-right: -4px !important;\n    margin-inline-start: -4px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="channel_"] [class*="unreadPill_"] {\n    left: auto !important;\n    right: -8px !important;\n    border-radius: var(--radius-xs, 4px) 0 0 var(--radius-xs, 4px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="wrapper_"] > [class*="unread_"]:not([class*="bar_"]) {\n    left: auto !important;\n    right: 0 !important;\n    border-radius: 4px 0 0 4px !important;\n}\n\n/* \u0625\u0635\u0644\u0627\u062D \u0643\u0628\u0633\u0648\u0644\u0629 \u0623\u0632\u0631\u0627\u0631 \u0627\u0644\u0645\u064A\u0643\u0631\u0648\u0641\u0648\u0646 \u0648\u0627\u0644\u0633\u0645\u0627\u0639\u0629 \u0648\u0627\u0644\u0633\u0647\u0645 \u0627\u0644\u0645\u0631\u0627\u0641\u0642 \u0644\u0647\u0627 \u0641\u064A \u0644\u0648\u062D\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0633\u0641\u0644\u064A\u0629 */\nhtml[data-arabic-rtl="1"] [class*="audioButtonParent_"] {\n    direction: rtl !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="audioButtonParent_"] [class*="audioButtonWithMenu_"] {\n    border-radius: 0 var(--radius-sm, 8px) var(--radius-sm, 8px) 0 !important;\n    border-start-start-radius: var(--radius-sm, 8px) !important;\n    border-end-start-radius: var(--radius-sm, 8px) !important;\n    border-start-end-radius: 0 !important;\n    border-end-end-radius: 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="audioButtonParent_"] [class*="buttonChevron_"] {\n    border-radius: var(--radius-sm, 8px) 0 0 var(--radius-sm, 8px) !important;\n    border-start-start-radius: 0 !important;\n    border-end-start-radius: 0 !important;\n    border-start-end-radius: var(--radius-sm, 8px) !important;\n    border-end-end-radius: var(--radius-sm, 8px) !important;\n    margin-left: 0 !important;\n    margin-right: 1px !important;\n    margin-inline-start: 1px !important;\n}\n\n/* \u0625\u0635\u0644\u0627\u062D \u0627\u062A\u062C\u0627\u0647 \u0648\u062A\u062F\u0631\u062C \u062E\u0644\u0641\u064A\u0629 \u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0627\u0633\u0645 (Nameplate) \u0648\u0645\u0646\u0639 \u062A\u062F\u0627\u062E\u0644 \u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u062D\u0627\u0644\u0629 \u0645\u0639 \u0625\u0637\u0627\u0631 \u0627\u0644\u0623\u0641\u0627\u062A\u0627\u0631 */\nhtml[data-arabic-rtl="1"] [class*="container_AFi54G"] {\n    direction: ltr !important;\n    transform: scaleX(-1);\n}\n\nhtml[data-arabic-rtl="1"] [class*="accountPopoutButtonWrapper_"] {\n    gap: 10px !important;\n}\n\nhtml[data-arabic-rtl="1"]\n    [class*="accountPopoutButtonWrapper_"]:has([class*="avatarDecorationContainer_"]) {\n    gap: 14px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="accountPopoutButtonWrapper_"] [class*="nameTag_"] {\n    text-align: start !important;\n}\n\n/* \u0639\u0643\u0633 \u0642\u0646\u0627\u0639 \u0623\u064A\u0642\u0648\u0646\u0627\u062A \u0627\u0644\u0633\u064A\u0631\u0641\u0631\u0627\u062A \u0627\u0644\u0645\u062A\u062F\u0627\u062E\u0644\u0629 \u0648\u0627\u0644\u062D\u0641\u0627\u0638 \u0639\u0644\u0649 \u0639\u0644\u0627\u0645\u0629 + \u0642\u0628\u0644 \u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0641\u064A \u0627\u0644\u0634\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0623\u0644\u0639\u0627\u0628 */\nhtml[data-arabic-rtl="1"] [class*="avatars_o4eL8l"] svg {\n    transform: scaleX(-1);\n}\n\nhtml[data-arabic-rtl="1"] [class*="avatars_o4eL8l"] [class*="squircleIcon_o4eL8l"] {\n    transform: scaleX(-1);\n}\n\nhtml[data-arabic-rtl="1"] [class*="hiddenCount_IqWmhA"],\nhtml[data-arabic-rtl="1"] [class*="displayCountText_s6-upr"],\nhtml[data-arabic-rtl="1"] [class*="overflow_o4eL8l"] {\n    direction: ltr !important;\n    unicode-bidi: isolate;\n}\n\nhtml[data-arabic-rtl="1"] [class*="hasUnreadDot_IqWmhA"]::before {\n    -webkit-mask: radial-gradient(circle at 3px 3px, transparent 5px, #000 0) !important;\n    mask: radial-gradient(circle at 3px 3px, transparent 5px, #000 0) !important;\n}\n\n/* \u0639\u0643\u0633 \u0642\u0646\u0627\u0639 \u0623\u064A\u0642\u0648\u0646\u0627\u062A \u0627\u0644\u0645\u062A\u0635\u0644\u064A\u0646 \u0628\u0627\u0644\u0635\u0648\u062A\u060C \u0648\u0634\u0627\u0631\u0629 \u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0634\u0631\u064A\u0637 \u0627\u0644\u0639\u0644\u0648\u064A \u0648\u062A\u062F\u0631\u062C\u0647\u060C \u0648\u062A\u062F\u0631\u062C\u0627\u062A \u0627\u0644\u062E\u0644\u0641\u064A\u0627\u062A \u0627\u0644\u062B\u0627\u0646\u0648\u064A\u0629 \u0641\u064A RTL */\nhtml[data-arabic-rtl="1"] [class*="avatarContainerMasked_"],\nhtml[data-arabic-rtl="1"] [class*="avatarContainerMasked_"] foreignObject > * {\n    transform: scaleX(-1);\n}\n\nhtml[data-arabic-rtl="1"] [class*="moreUsers_m-EqeQ"] {\n    direction: ltr !important;\n    unicode-bidi: isolate;\n}\n\nhtml[data-arabic-rtl="1"] [class*="iconWrapper_ybUK7Z"] {\n    direction: ltr !important;\n}\n\nhtml[data-arabic-rtl="1"].theme-dark [class*="children_ybUK7Z"]::after {\n    background: linear-gradient(\n        to left,\n        rgba(54, 57, 63, 0) 0,\n        var(--__header-bar-background) 100%\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"].theme-light [class*="children_ybUK7Z"]::after {\n    background: linear-gradient(\n        to left,\n        hsla(0, 0%, 100%, 0) 0,\n        var(--__header-bar-background) 100%\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="rowBackground_-JvGQh"] {\n    -webkit-mask: radial-gradient(\n        100% 100% at top right,\n        hsla(0, 0%, 100%, 0.3) 0,\n        hsla(0, 0%, 100%, 0) 100%\n    ) !important;\n    mask: radial-gradient(\n        100% 100% at top right,\n        hsla(0, 0%, 100%, 0.3) 0,\n        hsla(0, 0%, 100%, 0) 100%\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="splashArt_iVWY3l"] {\n    -webkit-mask: radial-gradient(\n        100% 100% at top right,\n        hsla(0, 0%, 100%, 0.6) 0,\n        hsla(0, 0%, 100%, 0) 100%\n    ) !important;\n    mask: radial-gradient(\n        100% 100% at top right,\n        hsla(0, 0%, 100%, 0.6) 0,\n        hsla(0, 0%, 100%, 0) 100%\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="borders_VCaaii"] {\n    -webkit-mask-image: linear-gradient(245deg, rgba(0, 0, 0, 0.25), transparent 70%) !important;\n    mask-image: linear-gradient(245deg, rgba(0, 0, 0, 0.25), transparent 70%) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="bordersTopLeft_VCaaii"] {\n    border-left-width: 0 !important;\n    border-right-width: 2px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="sizeSmall_ECBSq8"] [class*="placeholderContainer_ECBSq8"] {\n    -webkit-mask-image: linear-gradient(\n        to left,\n        #000 calc(100% - var(--custom-option-add-button-padding)),\n        transparent 100%\n    ) !important;\n    mask-image: linear-gradient(\n        to left,\n        #000 calc(100% - var(--custom-option-add-button-padding)),\n        transparent 100%\n    ) !important;\n}\n\n/* \u0639\u0643\u0633 \u0627\u0644\u062A\u062F\u0631\u062C\u0627\u062A \u0627\u0644\u0644\u0648\u0646\u064A\u0629 \u0648\u0623\u0642\u0646\u0639\u0629 \u0627\u0644\u062A\u0644\u0627\u0634\u064A \u0627\u0644\u062C\u0627\u0646\u0628\u064A\u0629 \u0641\u064A \u0634\u0631\u064A\u0637 \u0627\u0644\u062A\u0645\u0631\u064A\u0631 \u0648\u0627\u0644\u0628\u062D\u062B \u0648\u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u0631\u0633\u0645\u064A\u0629 */\nhtml[data-arabic-rtl="1"]:not(.custom-theme-background) [class*="edgeFadeStart_UQqFnR"] {\n    background: linear-gradient(to left, var(--background-surface-high), transparent) !important;\n}\n\nhtml[data-arabic-rtl="1"]:not(.custom-theme-background) [class*="edgeFadeEnd_UQqFnR"] {\n    background: linear-gradient(to right, var(--background-surface-high), transparent) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="leftPanel_zhJF5z"],\nhtml[data-arabic-rtl="1"] [class*="leftPanel_FmNv9Q"] {\n    background: radial-gradient(\n        ellipse at top right,\n        var(--expressive-gradient-purple-end) 0,\n        transparent 70%\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="voiceChannelHighlightGlow_"] {\n    background: radial-gradient(\n        ellipse 40px 50% at right center,\n        rgba(0, 158, 66, 0.125) 0,\n        rgba(0, 158, 66, 0) 100%\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="item_lm2_KW"] {\n    -webkit-mask-image: linear-gradient(\n        to left,\n        var(--background-surface-high) 90%,\n        transparent 100%\n    ) !important;\n    mask-image: linear-gradient(\n        to left,\n        var(--background-surface-high) 90%,\n        transparent 100%\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="roleStyleMessageContainer_"]::after {\n    background: linear-gradient(to left, transparent, var(--background-base-lowest)) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="searchFloating_"] {\n    background: linear-gradient(\n        to left,\n        transparent 0,\n        var(--background-base-lower) 40px,\n        var(--background-base-lower) 100%\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="guildOfficialMessage_"] {\n    background-image: linear-gradient(\n        to left,\n        color-mix(\n            in srgb,\n            var(--custom-guild-official-message)\n                calc(var(--custom-guild-official-message-alpha) * 100%),\n            transparent\n        ),\n        transparent\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="emojiRow_XTvD56"] [class*="emojiImage_XTvD56"] {\n    background-position: 100% 50% !important;\n}\n\n/* \u0639\u0643\u0633 \u0627\u0644\u062D\u0648\u0627\u0641 \u0627\u0644\u062F\u0627\u0626\u0631\u064A\u0629 \u0627\u0644\u062C\u0627\u0646\u0628\u064A\u0629 \u063A\u064A\u0631 \u0627\u0644\u0645\u062A\u0646\u0627\u0638\u0631\u0629 (Split Pills / Panels / Date Range) \u0641\u064A RTL */\nhtml[data-arabic-rtl="1"] [class*="topicsCaretLeft_"] {\n    border-radius: 0 20px 20px 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="topicsCaretRight_"] {\n    border-radius: 20px 0 0 20px !important;\n}\n\nhtml[data-arabic-rtl="1"]\n    [class*="bar_UIX3Vg"]\n    > :first-child:not(:only-child)\n    [class*="button_UIX3Vg"] {\n    border-radius: 6px 100px 100px 6px !important;\n}\n\nhtml[data-arabic-rtl="1"]\n    [class*="bar_UIX3Vg"]\n    > :last-child:not(:only-child)\n    [class*="button_UIX3Vg"] {\n    border-radius: 100px 6px 6px 100px !important;\n}\n\nhtml[data-arabic-rtl="1"]\n    [class*="chat_z_gUBg"][class*="threadSidebarOpen_z_gUBg"]:not(\n        [class*="threadSidebarFloating_z_gUBg"]\n    )\n    [class*="uploadArea_z_gUBg"] {\n    border-radius: 8px 0 0 8px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="answerPill_lm2_KW"] {\n    border-radius: var(--radius-xs) 0 0 var(--radius-xs) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="editingPanelExpanded_"] [class*="editingPanel_"] {\n    border-radius: 0 var(--radius-lg) var(--radius-lg) 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="editingPanelExpanded_"] [class*="profileContentOuter_"] {\n    border-radius: var(--radius-lg) 0 0 var(--radius-lg) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="thumbnail_Sy_obt"] [class*="nameplateContainer"] {\n    border-radius: var(--radius-xs) 0 0 var(--radius-xs) !important;\n}\n\nhtml[data-arabic-rtl="1"]\n    [class*="rangeSelection_02T8vR"][data-selection-start="true"]:not([data-selection-end="true"]),\nhtml[data-arabic-rtl="1"]\n    [class*="calendarGrid_02T8vR"]\n    td:first-child:not(:last-child)[aria-selected="true"]\n    [class*="cell_02T8vR"] {\n    border-radius: 0 var(--radius-sm) var(--radius-sm) 0 !important;\n}\n\nhtml[data-arabic-rtl="1"]\n    [class*="rangeSelection_02T8vR"][data-selection-end="true"]:not([data-selection-start="true"]),\nhtml[data-arabic-rtl="1"]\n    [class*="calendarGrid_02T8vR"]\n    td:last-child:not(:first-child)[aria-selected="true"]\n    [class*="cell_02T8vR"] {\n    border-radius: var(--radius-sm) 0 0 var(--radius-sm) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="previewContainer_fXYEi6"] {\n    border-radius: 12px 0 0 12px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="inviteSplash_4hnqn0"] {\n    border-radius: 5px 0 0 5px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="newlyAddedHighlight_"] {\n    border-radius: 4px 4px 0 4px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="editPanel_"] {\n    left: auto !important;\n    right: 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="editPanel_"]:not([class*="active_"]) {\n    transform: translateX(calc(var(--custom-gallery-panel-width) * -1)) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="galleryPanel_"]:not([class*="active_"]) {\n    transform: translateX(var(--custom-gallery-panel-width)) !important;\n}\n\nhtml[data-arabic-rtl="1"] div[class*="profileThemedContainer_"] {\n    border-radius: 0 8px 8px 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="sidebar_3h-1-Q"] {\n    border-radius: 0 5px 5px 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="noticeArrow_6XH7h0"] {\n    transform: translateX(4px) rotate(45deg) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="viewAllGamesButton_"]:hover [class*="viewAllIcon_"],\nhtml[data-arabic-rtl="1"] [class*="viewAllGames_"]:hover [class*="viewAllIcon_"],\nhtml[data-arabic-rtl="1"] [class*="viewAllNitroGames_"]:hover [class*="viewAllIcon_"] {\n    transform: rotate(90deg) translateY(3px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="editingPanelExpandButtonDefault_"] {\n    transform: translateX(-12px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="editingPanelExpandButtonDefault_"]:focus-visible,\nhtml[data-arabic-rtl="1"] [class*="editingPanelExpandButtonDefault_"]:hover {\n    transform: translateX(0) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="viewer_Xa_Vtp"] {\n    transform: scaleX(-1);\n}\n\nhtml[data-arabic-rtl="1"] [class*="viewer_Xa_Vtp"] > * {\n    transform: scaleX(-1);\n}\n\nhtml[data-arabic-rtl="1"] [class*="overflow_Xa_Vtp"] {\n    direction: ltr !important;\n    box-shadow: 1px 0 0 1px var(--black) !important;\n}\n\n/* \u0639\u0643\u0633 \u0646\u0642\u0637\u0629 \u0627\u0644\u0627\u0631\u062A\u0643\u0627\u0632 \u0627\u0644\u062D\u0631\u0643\u064A\u0629 (transform-origin) \u0644\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0645\u0648\u062C\u0647\u0629 \u0641\u064A RTL */\nhtml[data-arabic-rtl="1"] [class*="partnerBranding_BSEPzZ"] {\n    transform-origin: right !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="textContainer_tq3QTU"],\nhtml[data-arabic-rtl="1"] [class*="rewardTileContainer_tq3QTU"] {\n    transform-origin: right center !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="rewardTileContainer_9RdcFK"],\nhtml[data-arabic-rtl="1"] [class*="bar_O2ifdm"] {\n    transform-origin: top right !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="extrasBottomOriented_yjvjn7"] {\n    transform-origin: 100% 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="extrasRightOriented_yjvjn7"] {\n    transform-origin: 0 100% !important;\n}\n\nhtml[data-arabic-rtl="1"]\n    [class*="extrasBottomOriented_yjvjn7"][class*="extrasRightOriented_yjvjn7"] {\n    transform-origin: 0 0 !important;\n}\n\n/* \u0639\u0643\u0633 \u0642\u0635\u0627\u0635\u0627\u062A \u0627\u0644\u0645\u0633\u0627\u0631\u0627\u062A (clip-path) \u0627\u0644\u062C\u0627\u0646\u0628\u064A\u0629 \u0644\u0628\u0637\u0627\u0642\u0627\u062A \u0627\u0644\u0625\u0646\u062C\u0627\u0632 \u0648\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0641\u064A RTL */\nhtml[data-arabic-rtl="1"] [class*="outerContainer_Hv1EkO"] {\n    clip-path: inset(0 16px 0 0) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="logo_frvJop"] {\n    clip-path: polygon(0 0, 100% 0, 100% 100%, 25% 100%, 0 75%) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="footer_bcgTHb"] {\n    clip-path: polygon(13px 0, 100% 0, 100% 100%, 0 100%, 0 12px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="rank_DeLaSu"] {\n    clip-path: polygon(\n        0 0,\n        100% 0,\n        100% 100%,\n        var(--space-12) 100%,\n        0 calc(100% - var(--space-12))\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="artBox_M5fVqw"] [class*="rank_M5fVqw"] {\n    clip-path: polygon(\n        0 0,\n        100% 0,\n        100% 100%,\n        var(--space-12) 100%,\n        0 calc(100% - var(--space-16) + 1px)\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="rarity_1lwQ1X"] {\n    clip-path: polygon(0 0, 100% 0, 100% 100%) !important;\n}\n\n/* \u0639\u0643\u0633 \u0645\u062D\u0627\u0630\u0627\u0629 \u0627\u0644\u0635\u0648\u0631 \u0648\u0627\u0644\u0644\u0627\u0641\u062A\u0627\u062A \u0627\u0644\u0627\u062A\u062C\u0627\u0647\u064A\u0629 (object-position) \u0641\u064A RTL */\nhtml[data-arabic-rtl="1"] [class*="questHomeHeroBackgroundImage_"] {\n    object-position: left !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="heroImage_Ls3EVK"],\nhtml[data-arabic-rtl="1"] [class*="overlayWidgetImage_"] {\n    object-position: top left !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="animationAsset_cvJOaf"],\nhtml[data-arabic-rtl="1"] [class*="catalogBannerImage_cvJOaf"] {\n    object-position: right !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="wideBannerArt_XBXDcd"] {\n    object-position: right center !important;\n}\n\n/* \u0645\u0646\u0639 \u0627\u0646\u0639\u0643\u0627\u0633 \u0627\u0644\u0643\u0627\u0648\u0645\u0648\u062C\u064A \u0648\u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0641\u064A \u0634\u0627\u0634\u0629 \u0627\u0644\u062A\u0631\u062D\u064A\u0628 \u0648\u0627\u0644\u062A\u062D\u0645\u064A\u0644 */\nhtml[data-arabic-rtl="1"] [class*="tip_oDjP9R"],\nhtml[data-arabic-rtl="1"] [class*="title_oDjP9R"],\nhtml[data-arabic-rtl="1"] [class*="body_oDjP9R"],\nhtml[data-arabic-rtl="1"] [class*="problemsText_oDjP9R"] {\n    unicode-bidi: plaintext !important;\n}\n\n/* \u062A\u0648\u0633\u064A\u0637 \u0639\u0646\u0648\u0627\u0646 "\u0646\u0634\u0637 \u0627\u0644\u0622\u0646" \u0644\u064A\u062A\u0645\u0627\u0634\u0649 \u0645\u0639 \u0627\u0644\u0643\u0627\u0631\u062A \u0623\u0633\u0641\u0644\u0647 */\nhtml[data-arabic-rtl="1"] [class*="nowPlayingColumn_"] [class*="header_"],\nhtml[data-arabic-rtl="1"] [class*="nowPlayingScroller_"] > h2,\nhtml[data-arabic-rtl="1"] [class*="nowPlayingTitle_"] {\n    text-align: center !important;\n    justify-content: center !important;\n}\n\n/* \u0639\u0643\u0633 \u0645\u0624\u0634\u0631 \u0627\u0644\u062A\u0628\u0648\u064A\u0628 \u0627\u0644\u0646\u0634\u0637 \u0648\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062A\u0628\u0648\u064A\u0628\u0627\u062A \u0627\u0644\u0623\u0641\u0642\u064A\u0629 */\nhtml[data-arabic-rtl="1"] [class*="top_"] [class*="item_"] + [class*="item_"] {\n    margin-left: 0 !important;\n    margin-inline-start: var(--space-xl, 16px) !important;\n}\n\n/* \u0639\u0643\u0633 \u0627\u0644\u0623\u0633\u0647\u0645 \u0627\u0644\u0627\u062A\u062C\u0627\u0647\u064A\u0629 (ChevronSmallRight / ChevronSmallLeft) \u062E\u0627\u0631\u062C \u0634\u0631\u064A\u0637 \u0627\u0644\u0646\u0627\u0641\u0630\u0629 */\nhtml[data-arabic-rtl="1"]\n    svg[viewBox="0 0 24 24"]:has(> path[d^="M9.3 5.3a1 1 0 0 0 0 1.4l5.29 5.3"]),\nhtml[data-arabic-rtl="1"]\n    svg[viewBox="0 0 24 24"]:has(> path[d^="M14.7 5.3a1 1 0 0 1 0 1.4L9.42 12"]),\nhtml[data-arabic-rtl="1"] .vc-plugin-ui-elements-button-arrow {\n    transform: scaleX(-1);\n}\n\n/* \u0639\u0643\u0633 \u0633\u0647\u0645 \u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0642\u0646\u0648\u0627\u062A \u0648\u0627\u0644\u0640 Accordions \u0627\u0644\u0645\u0637\u0648\u064A\u0629 \u0644\u062A\u0634\u064A\u0631 \u0644\u0644\u064A\u0633\u0627\u0631 \u0628\u062F\u0644 \u0627\u0644\u064A\u0645\u064A\u0646 */\nhtml[data-arabic-rtl="1"] [class*="chevron_"][class*="collapsed_"],\nhtml[data-arabic-rtl="1"] [class*="arrowCollapsed_"],\nhtml[data-arabic-rtl="1"] [class*="showMoreEmojisArrowCollapsed_"] {\n    transform: rotate(90deg) !important;\n}\n\n/* \u0625\u0635\u0644\u0627\u062D \u0645\u0648\u0636\u0639 \u0648\u0627\u062A\u062C\u0627\u0647 \u0623\u0633\u0647\u0645 \u0627\u0644\u062A\u0644\u0645\u064A\u062D\u0627\u062A (Tooltips) \u0648\u0627\u0644\u0641\u0642\u0627\u0639\u0627\u062A \u0627\u0644\u0645\u0646\u0628\u062B\u0642\u0629 (Popovers) \u0641\u064A RTL */\nhtml[data-arabic-rtl="1"] [class*="tooltipLeft_"] [class*="tooltipPointer_"] {\n    inset-inline-start: auto !important;\n    inset-inline-end: auto !important;\n    left: 100% !important;\n    right: auto !important;\n    margin-inline-start: 0 !important;\n    margin-left: -1.5px !important;\n    border: 5px solid transparent !important;\n    border-top: 5px solid var(--tooltip-pointer-bg) !important;\n    transform: rotate(-90deg) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="tooltipRight_"] [class*="tooltipPointer_"] {\n    inset-inline-start: auto !important;\n    inset-inline-end: auto !important;\n    right: 100% !important;\n    left: auto !important;\n    margin-inline-end: 0 !important;\n    margin-right: -1.5px !important;\n    border: 5px solid transparent !important;\n    border-top: 5px solid var(--tooltip-pointer-bg) !important;\n    transform: rotate(90deg) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="caret--left_"] {\n    inset-inline-start: auto !important;\n    inset-inline-end: auto !important;\n    left: calc(var(--custom-caret-horizontal-distance, 11px) * -1) !important;\n    right: auto !important;\n    transform: rotate(90deg) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="caret--right_"] {\n    inset-inline-start: auto !important;\n    inset-inline-end: auto !important;\n    right: calc(var(--custom-caret-horizontal-distance, 11px) * -1) !important;\n    left: auto !important;\n    transform: rotate(-90deg) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="tooltipTop_"] [class*="tooltipPointer_"],\nhtml[data-arabic-rtl="1"] [class*="tooltipBottom_"] [class*="tooltipPointer_"],\nhtml[data-arabic-rtl="1"] [class*="tooltipCenter_"] [class*="tooltipPointer_"] {\n    inset-inline-start: auto !important;\n    left: 50% !important;\n    right: auto !important;\n    margin-inline-start: 0 !important;\n    margin-left: -5px !important;\n}\n\nhtml[data-arabic-rtl="1"]\n    :is([class*="caret--top_"], [class*="caret--bottom_"])[class*="caret--center_"] {\n    inset-inline-start: auto !important;\n    inset-inline-end: auto !important;\n    left: calc(50% + var(--custom-caret-edge-offset-horizontal-nudge, 0px)) !important;\n    right: auto !important;\n    margin-inline-start: 0 !important;\n    margin-left: calc(var(--custom-caret-half-width, 8px) * -1) !important;\n}\n\nhtml[data-arabic-rtl="1"]\n    :is([class*="caret--top_"], [class*="caret--bottom_"])[class*="caret--custom_"] {\n    inset-inline-start: auto !important;\n    inset-inline-end: auto !important;\n    left: 50% !important;\n    right: auto !important;\n    margin-inline-start: 0 !important;\n    margin-left: calc(\n        var(--custom-caret-offset-x, 0px) - var(--custom-caret-half-width, 8px)\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="premiumBanner_"] [class*="premiumIcon_"] {\n    margin-right: 0 !important;\n    margin-inline-end: 16px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="icon_VhFsFg"] {\n    padding-right: 0 !important;\n    padding-inline-end: var(--space-4, 4px) !important;\n}\n\n/* \u0625\u0635\u0644\u0627\u062D \u062A\u0631\u0648\u064A\u0633\u0627\u062A \u0627\u0644\u0646\u0648\u0627\u0641\u0630 \u0627\u0644\u062D\u062F\u064A\u062B\u0629 (Modals) \u0648\u062D\u0642\u0648\u0644 \u0627\u0644\u0646\u0645\u0627\u0630\u062C \u0630\u0627\u062A \u0627\u0644\u0647\u0648\u0627\u0645\u0634 \u0627\u0644\u0641\u064A\u0632\u064A\u0627\u0626\u064A\u0629 */\nhtml[data-arabic-rtl="1"] [class*="headerLeading_"],\nhtml[data-arabic-rtl="1"] [class*="headerLeadingSpacer_"] {\n    margin-left: 0 !important;\n    margin-inline-start: calc((var(--custom-modal-padding) - var(--space-8)) * -1) !important;\n    padding-right: 0 !important;\n    padding-inline-end: var(--space-12) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="headerTrailing_"],\nhtml[data-arabic-rtl="1"] [class*="headerTrailingSpacer_"] {\n    margin-right: 0 !important;\n    margin-inline-end: calc((var(--custom-modal-padding) - var(--space-8)) * -1) !important;\n    padding-left: 0 !important;\n    padding-inline-start: var(--space-12) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="headerLeadingAbsolute_"] {\n    left: auto !important;\n    right: var(--custom-modal-padding, 16px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="headerTrailingAbsolute_"] {\n    right: auto !important;\n    left: var(--custom-modal-padding, 16px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="actionBarTrailing_"] {\n    margin-left: 0 !important;\n    margin-inline-start: auto !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="required_"],\nhtml[data-arabic-rtl="1"] [class*="badgeContainer_"] {\n    margin-left: 0 !important;\n    margin-inline-start: var(--space-4, 4px) !important;\n}\n\n/* \u0625\u0635\u0644\u0627\u062D \u0627\u0644\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0631\u0642\u0645\u064A\u0629 \u0648\u0627\u0644\u0646\u0642\u0637\u064A\u0629 \u0641\u064A \u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0640 Changelog */\nhtml[data-arabic-rtl="1"] [class*="content_"] ol li {\n    margin-left: 0 !important;\n    margin-inline-start: 20px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="socialLink_"],\nhtml[data-arabic-rtl="1"] [class*="premiumIcon_"] {\n    margin-right: 0 !important;\n    margin-inline-end: 16px !important;\n}\n\n/* \u0639\u0643\u0633 \u0627\u0644\u0647\u0648\u0627\u0645\u0634 \u0627\u0644\u0641\u064A\u0632\u064A\u0627\u0626\u064A\u0629 \u0641\u064A \u0645\u0643\u0648\u0646\u0627\u062A \u0648\u0625\u0639\u062F\u0627\u062F\u0627\u062A Vencord */\nhtml[data-arabic-rtl="1"] .vc-form-switch > :last-child,\nhtml[data-arabic-rtl="1"] .vc-plugin-ui-elements-switches-row :last-child,\nhtml[data-arabic-rtl="1"] .vc-expandable-card-icon,\nhtml[data-arabic-rtl="1"] .vc-plugin-ui-elements-button-arrow,\nhtml[data-arabic-rtl="1"] .vc-settings-modal-links,\nhtml[data-arabic-rtl="1"] .vc-author-modal-links {\n    margin-left: 0 !important;\n    margin-inline-start: auto !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-plugins-info-button {\n    margin-right: 0 !important;\n    margin-inline-end: 8px !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-btn-link-icon {\n    margin-left: 0 !important;\n    margin-inline-start: 8px !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-notification-log-timestamp,\nhtml[data-arabic-rtl="1"] .vc-permviewer-modal-perms-item .vc-info-icon {\n    margin-left: 0 !important;\n    margin-inline-start: auto !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-author-modal-name {\n    border-radius: 9999px 0 0 9999px !important;\n    padding: 6px 0.5em 6px 0.8em !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-author-modal-name::before {\n    left: auto !important;\n    right: -32px !important;\n    border-radius: 0 9999px 9999px 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-donate-button .vc-heart-icon {\n    margin-right: 0 !important;\n    margin-inline-end: 0.5em !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-special-image-container {\n    margin-left: 0 !important;\n    margin-inline-start: 1em !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-settings-tab-bar-item {\n    margin-right: 0 !important;\n    margin-inline-end: 32px !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-betterSessions-rename-btn,\nhtml[data-arabic-rtl="1"] .vc-betterSessions-new-btn,\nhtml[data-arabic-rtl="1"] .vc-rdb-badge {\n    margin-left: 0 !important;\n    margin-inline-start: 4px !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-membercount-tooltip {\n    margin-left: 0 !important;\n    margin-inline-start: 2px !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-ranb-button {\n    margin-inline: 0 !important;\n    padding-inline: 4px !important;\n    font-size: 12px !important;\n    text-align: center !important;\n    white-space: nowrap !important;\n}\n\n/* \u062F\u0639\u0645 \u0627\u0644\u0634\u0631\u064A\u0637 \u0627\u0644\u062C\u0627\u0646\u0628\u064A \u0644\u0625\u0636\u0627\u0641\u0629 BetterFolders \u0648\u0639\u062F\u0645 \u0642\u0635 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0642\u0646\u0648\u0627\u062A \u0623\u0648 \u062A\u062F\u0627\u062E\u0644 \u0644\u0648\u062D\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0639\u0646\u062F \u0641\u062A\u062D \u0627\u0644\u0645\u062C\u0644\u062F\u0627\u062A */\nhtml[data-arabic-rtl="1"]\n    .vc-betterFolders-sidebar-grid\n    [class*="sidebar_"]:not([data-collapsed="true"]):has(> [class*="sidebarList_"]) {\n    width: auto !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-betterFolders-sidebar {\n    direction: rtl !important;\n    min-width: var(--custom-guild-list-width);\n}\n\nhtml[data-arabic-rtl="1"] .vc-shc-hidden-channel-icon,\nhtml[data-arabic-rtl="1"] .vc-typing-indicator-avatars,\nhtml[data-arabic-rtl="1"] .vc-typing-indicator-dots {\n    margin-left: 0 !important;\n    margin-inline-start: 6px !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-cfc-button {\n    margin-left: 0 !important;\n    margin-inline-start: 16px !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-uvs-profile-speaker {\n    margin-right: 0 !important;\n    margin-inline-end: 4px !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-trans-accessory-icon,\nhtml[data-arabic-rtl="1"] .vc-typing-tweaks-user [class*="wrapper"] {\n    margin-right: 0 !important;\n    margin-inline-end: 0.25em !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-sortFriendRequests-wrapper {\n    margin-right: 0 !important;\n    margin-inline-end: 0.5em !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-customCommands-card {\n    padding-left: 0.5em !important;\n    padding-inline-start: 1em !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-permviewer-modal-list,\nhtml[data-arabic-rtl="1"] .vc-permviewer-modal-perms {\n    padding-right: 0 !important;\n    padding-inline-end: 8px !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-charCounter-counter {\n    right: auto !important;\n    left: 11px !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-dearrow-toggle-on,\nhtml[data-arabic-rtl="1"] .vc-dearrow-toggle-off {\n    right: auto !important;\n    left: 0.75rem !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-rdb-review {\n    padding-right: 12px !important;\n    padding-inline-end: 64px !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-rdb-vote-column {\n    right: auto !important;\n    left: 16px !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-std-wrapper {\n    gap: 4px;\n}\n\nhtml[data-arabic-rtl="1"] .vc-std-wrapper [class*="communicationDisabled"] {\n    margin-left: 0 !important;\n    margin-inline-end: 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-gp-server-info-pair [class*="timestamp"] {\n    margin-inline-start: 0 !important;\n}\n\n/* \u062A\u0646\u0633\u064A\u0642 \u0635\u0641\u062D\u0629 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0625\u0636\u0627\u0641\u0627\u062A \u0648\u0634\u0631\u064A\u0637 \u0627\u0644\u062A\u0645\u0631\u064A\u0631 \u0648\u0643\u0627\u0631\u062A \u0623\u062F\u0648\u0627\u062A ArabicDiscord */\nhtml[data-arabic-rtl="1"] .vc-addon-author::before {\n    content: "\u0628\u0648\u0627\u0633\u0637\u0629 ";\n}\n\nhtml[data-arabic-rtl="1"] .vc-addon-note {\n    height: auto !important;\n    min-height: 36px;\n    max-height: 44px;\n    line-height: 1.45 !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-plugins-filter-controls {\n    height: auto !important;\n    min-height: 40px;\n}\n\nhtml[data-arabic-rtl="1"] .vc-plugins-settings {\n    gap: 1em !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-plugins-setting-section {\n    padding-bottom: 1em;\n    border-bottom: 1px solid var(--border-subtle);\n}\n\nhtml[data-arabic-rtl="1"] .vc-plugins-setting-section:last-child {\n    padding-bottom: 0;\n    border-bottom: none;\n}\n\nhtml[data-arabic-rtl="1"] .vc-plugins-setting-inline {\n    gap: 16px !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-plugins-setting-section [class*="slider_"] {\n    box-sizing: border-box !important;\n    padding-inline: 10px !important;\n}\n\n.vc-arabic-actions-card {\n    background-color: var(--background-base-lower);\n    border: 1px solid var(--border-subtle);\n    border-radius: var(--radius-md, 10px);\n    padding: 14px 16px;\n}\n\n.vc-arabic-stats-row {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 8px;\n}\n\n.vc-arabic-stat-pill {\n    background-color: var(--background-mod-subtle);\n    border: 1px solid var(--border-subtle);\n    border-radius: var(--radius-sm, 6px);\n    color: var(--text-default);\n    font-size: 12px;\n    font-weight: 500;\n    padding: 4px 10px;\n}\n\n/* \u0639\u0643\u0633 \u0627\u0644\u0623\u0642\u0646\u0639\u0629 \u0627\u0644\u0627\u062A\u062C\u0627\u0647\u064A\u0629 \u0648\u062B\u0642\u0648\u0628 \u0627\u0644\u062A\u0639\u062A\u064A\u0645 (Masks & Cutouts) \u0644\u062A\u062A\u0637\u0627\u0628\u0642 \u0645\u0639 \u062A\u0645\u0648\u0636\u0639 RTL */\nhtml[data-arabic-rtl="1"] [class*="iconContainer_"] [class*="iconImage_"],\nhtml[data-arabic-rtl="1"] [class*="iconContainer_"] [class*="iconPlaceholder_"] {\n    -webkit-mask-image: radial-gradient(circle at 16px 16px, transparent 20px, #000 0) !important;\n    mask-image: radial-gradient(circle at 16px 16px, transparent 20px, #000 0) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="iconContainer_"][class*="petite_"] [class*="iconImage_"],\nhtml[data-arabic-rtl="1"] [class*="iconContainer_"][class*="petite_"] [class*="iconPlaceholder_"] {\n    -webkit-mask-image: radial-gradient(circle at 12px 12px, transparent 16px, #000 0) !important;\n    mask-image: radial-gradient(circle at 12px 12px, transparent 16px, #000 0) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="hasUnreadDot_"]::before {\n    -webkit-mask: radial-gradient(circle at 3px 3px, transparent 5px, #000 0) !important;\n    mask: radial-gradient(circle at 3px 3px, transparent 5px, #000 0) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="masked_ncMHEz"] {\n    -webkit-mask-image: radial-gradient(\n        circle at 3px calc(100% - 3px),\n        transparent var(--custom-dot-cutout-radius, 5px),\n        #000 calc(var(--custom-dot-cutout-radius, 5px) + 0.5px)\n    ) !important;\n    mask-image: radial-gradient(\n        circle at 3px calc(100% - 3px),\n        transparent var(--custom-dot-cutout-radius, 5px),\n        #000 calc(var(--custom-dot-cutout-radius, 5px) + 0.5px)\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="dot_ncMHEz"] {\n    right: auto !important;\n    left: 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="mask_4I8LkS"] {\n    --custom-dot-center: calc(var(--custom-dot-size, 6px) / 2);\n}\n\nhtml[data-arabic-rtl="1"] [class*="iconCutout_bUsGtA"] {\n    -webkit-mask-image: radial-gradient(\n        circle at 3px calc(100% - 5px),\n        transparent 9px,\n        #000 9.5px\n    ) !important;\n    mask-image: radial-gradient(\n        circle at 3px calc(100% - 5px),\n        transparent 9px,\n        #000 9.5px\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="authorAvatars_"] li:not(:last-child) {\n    -webkit-mask-image: radial-gradient(\n        circle var(--space-12) at calc(100% - var(--space-24)) 50%,\n        transparent 100%,\n        var(--text-default) 100%\n    ) !important;\n    mask-image: radial-gradient(\n        circle var(--space-12) at calc(100% - var(--space-24)) 50%,\n        transparent 100%,\n        var(--text-default) 100%\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="canvas_"][style*="--custom-waveform-spacing"] {\n    -webkit-mask-image: linear-gradient(\n        to left,\n        transparent 0,\n        var(--text-default) 12%,\n        var(--text-default) 100%\n    ) !important;\n    mask-image: linear-gradient(\n        to left,\n        transparent 0,\n        var(--text-default) 12%,\n        var(--text-default) 100%\n    ) !important;\n}\n\n/* \u0639\u0643\u0633 \u0627\u0644\u062D\u0648\u0627\u0641 \u0627\u0644\u0645\u0633\u062A\u062F\u064A\u0631\u0629 \u063A\u064A\u0631 \u0627\u0644\u0645\u062A\u0645\u0627\u062B\u0644\u0629 (Asymmetric Border Radii) \u0648\u0645\u0624\u0634\u0631 \u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 */\nhtml[data-arabic-rtl="1"] [class*="newMessagesPill_"] {\n    border-radius: 0 18px 18px 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="newMessagesClear_"] {\n    border-radius: 18px 0 0 18px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="endCap_"][class*="unreadPill_"] {\n    border-radius: 4px 0 0 4px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="unreadPillCap_"] {\n    transform: scaleX(-1);\n}\n\nhtml[data-arabic-rtl="1"] [class*="unreadDot_"],\nhtml[data-arabic-rtl="1"] [class*="forumPost_"] [class*="unread_"] {\n    border-radius: var(--radius-xs, 4px) 0 0 var(--radius-xs, 4px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="popover_yDAPhH"] > :first-child > [class*="button_"] {\n    border-radius: 6px 100px 100px 6px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="popover_yDAPhH"] > :last-child > [class*="button_"] {\n    border-radius: 100px 6px 6px 100px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="attachedButton_"] {\n    border-radius: 0 8px 8px 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="contextMenuNub_"][class*="attachedCaret_"] {\n    border-radius: 8px 0 0 8px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="baseShapeRoundLeft_"] {\n    border-radius: 0 var(--radius-xs, 4px) var(--radius-xs, 4px) 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="baseShapeRoundRight_"] {\n    border-radius: var(--radius-xs, 4px) 0 0 var(--radius-xs, 4px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="galleryItem_"][class*="first_"] {\n    border-radius: 2px 8px 8px 2px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="galleryItem_"][class*="last_"] {\n    border-radius: 8px 2px 2px 8px !important;\n}\n\n/* \u0639\u0643\u0633 \u0627\u0644\u0623\u0633\u0647\u0645 \u0627\u0644\u062F\u0648\u0631\u0627\u0646\u064A\u0629 \u0648\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0646\u0642\u0627\u0637 \u0648\u0639\u0644\u0627\u0645\u0627\u062A GIF */\nhtml[data-arabic-rtl="1"] [class*="headerCollapseIconCollapsed_"],\nhtml[data-arabic-rtl="1"] [class*="arrowIcon_"]:not([class*="arrowIconExpanded_"]),\nhtml[data-arabic-rtl="1"] [class*="rowButtonArrow_"],\nhtml[data-arabic-rtl="1"] [class*="titleCaret_"] {\n    transform: rotate(90deg) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="content_"] ul li::before {\n    left: auto !important;\n    right: -15px !important;\n    margin-left: 0 !important;\n    margin-right: -3px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="inlineImageGifTag_"] {\n    left: auto !important;\n    right: var(--space-8, 8px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="tag_"]:has([slot="remove"]) {\n    padding-right: 0 !important;\n    padding-inline-end: var(--space-8, 8px) !important;\n}\n\n/* \u0625\u0635\u0644\u0627\u062D \u0644\u0648\u062D\u0627\u062A \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0648\u0627\u0644\u062A\u0628\u0648\u064A\u0628\u0627\u062A \u0627\u0644\u062C\u0627\u0646\u0628\u064A\u0629 \u0648\u0623\u0634\u0631\u0637\u0629 \u0627\u0644\u062A\u0645\u0631\u064A\u0631 \u0648\u0627\u0644\u062A\u062F\u0631\u062C\u0627\u062A \u0627\u0644\u0645\u062A\u0628\u0642\u064A\u0629 \u0641\u064A RTL */\nhtml[data-arabic-rtl="1"] [class*="editingPanel_"]:not([class*="isExpanded_"]) {\n    transform: translateX(-100%) !important;\n}\n\n@media (min-width: 929px) {\n    html[data-arabic-rtl="1"] [class*="editingPanel_"]:not([class*="isExpanded_"]) {\n        transform: none !important;\n    }\n}\n\nhtml[data-arabic-rtl="1"] [class*="tabButton_BfN7RR"] {\n    border-radius: 0 var(--radius-md, 8px) var(--radius-md, 8px) 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="item_Wzc60b"] {\n    border-width: 1px 0 1px 1px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="item_Wzc60b"]:first-child {\n    border-right-width: 1px !important;\n    border-left-width: 0 !important;\n    border-radius: 0 3px 3px 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="item_Wzc60b"]:last-child {\n    border-left-width: 1px !important;\n    border-radius: 3px 0 0 3px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="roundLeft_"] {\n    border-radius: 0 var(--custom-live-indicator-border-radius)\n        var(--custom-live-indicator-border-radius) 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="roundRight_"] {\n    border-radius: var(--custom-live-indicator-border-radius) 0 0\n        var(--custom-live-indicator-border-radius) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="subscriberCountValue_"] {\n    border-radius: 0 4px 4px 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="subscriberCountText_"] {\n    border-radius: 4px 0 0 4px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="scrim_Zw-dUC"] {\n    -webkit-mask-image: linear-gradient(270deg, #000 424px, transparent 496px) !important;\n    mask-image: linear-gradient(270deg, #000 424px, transparent 496px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="fadeStart_"] {\n    -webkit-mask-image: linear-gradient(\n        270deg,\n        transparent,\n        #000 var(--custom-edge-fade-width)\n    ) !important;\n    mask-image: linear-gradient(270deg, transparent, #000 var(--custom-edge-fade-width)) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="fadeEnd_"] {\n    -webkit-mask-image: linear-gradient(\n        270deg,\n        #000,\n        #000 calc(100% - var(--custom-edge-fade-width)),\n        transparent\n    ) !important;\n    mask-image: linear-gradient(\n        270deg,\n        #000,\n        #000 calc(100% - var(--custom-edge-fade-width)),\n        transparent\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="heroAssetBlurredA_"] {\n    -webkit-mask: linear-gradient(270deg, #000, transparent 30%) !important;\n    mask: linear-gradient(270deg, #000, transparent 30%) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="heroAssetBlurredB_"] {\n    -webkit-mask: linear-gradient(270deg, #000 30%, transparent 70%) !important;\n    mask: linear-gradient(270deg, #000 30%, transparent 70%) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="progressiveBlur_D8O-nd"] {\n    -webkit-mask-image: linear-gradient(270deg, transparent 5%, #000 30%) !important;\n    mask-image: linear-gradient(270deg, transparent 5%, #000 30%) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="bodyScrollingSpacerBottom_"]:last-child::before,\nhtml[data-arabic-rtl="1"] [class*="bodyControls_"]::after {\n    left: var(--space-16) !important;\n    right: 0 !important;\n}\n\n/* \u0639\u0643\u0633 \u0627\u0644\u062A\u062F\u0631\u062C\u0627\u062A \u0648\u0627\u0644\u0623\u0642\u0646\u0639\u0629 \u0648\u0623\u0633\u0647\u0645 \u0627\u0644\u0642\u0648\u0627\u0626\u0645 \u0648\u0627\u0644\u062D\u0627\u0648\u064A\u0627\u062A \u0627\u0644\u062B\u0627\u0646\u0648\u064A\u0629 \u0641\u064A RTL */\nhtml[data-arabic-rtl="1"] [class*="channelTextArea_"] [class*="placeholder_"] {\n    direction: rtl !important;\n    text-align: start !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="channelNameFade_"] {\n    -webkit-mask-image: linear-gradient(\n        270deg,\n        #000 0,\n        #000 calc(100% - 16px),\n        transparent\n    ) !important;\n    mask-image: linear-gradient(270deg, #000 0, #000 calc(100% - 16px), transparent) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="marketingButtonBackgroundImageFaded_"] {\n    -webkit-mask-image: linear-gradient(\n        270deg,\n        transparent 0,\n        transparent 0,\n        rgba(0, 0, 0, 0.1) 50%,\n        rgba(0, 0, 0, 0.3) 60%,\n        rgba(0, 0, 0, 0.6) 70%,\n        #000 85%,\n        #000\n    ) !important;\n    mask-image: linear-gradient(\n        270deg,\n        transparent 0,\n        transparent 0,\n        rgba(0, 0, 0, 0.1) 50%,\n        rgba(0, 0, 0, 0.3) 60%,\n        rgba(0, 0, 0, 0.6) 70%,\n        #000 85%,\n        #000\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="imageFadeToLeftMask_"] {\n    -webkit-mask: linear-gradient(\n        270deg,\n        transparent 0,\n        rgba(0, 0, 0, 0.049) 9.2%,\n        rgba(0, 0, 0, 0.175) 18%,\n        rgba(0, 0, 0, 0.45) 32.6%,\n        rgba(0, 0, 0, 0.741) 51.4%,\n        rgba(0, 0, 0, 0.951) 77.3%,\n        #000\n    ) !important;\n    mask: linear-gradient(\n        270deg,\n        transparent 0,\n        rgba(0, 0, 0, 0.049) 9.2%,\n        rgba(0, 0, 0, 0.175) 18%,\n        rgba(0, 0, 0, 0.45) 32.6%,\n        rgba(0, 0, 0, 0.741) 51.4%,\n        rgba(0, 0, 0, 0.951) 77.3%,\n        #000\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="fadeLeft_l7oXIt"] {\n    -webkit-mask-image: linear-gradient(\n        to left,\n        transparent,\n        var(--text-default) var(--custom-conjure-preview-tabs-fade)\n    ) !important;\n    mask-image: linear-gradient(\n        to left,\n        transparent,\n        var(--text-default) var(--custom-conjure-preview-tabs-fade)\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="fadeRight_l7oXIt"] {\n    -webkit-mask-image: linear-gradient(\n        to left,\n        var(--text-default) calc(100% - var(--custom-conjure-preview-tabs-fade)),\n        transparent\n    ) !important;\n    mask-image: linear-gradient(\n        to left,\n        var(--text-default) calc(100% - var(--custom-conjure-preview-tabs-fade)),\n        transparent\n    ) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="filterPill_"] {\n    border-radius: 0 var(--radius-xs, 4px) var(--radius-xs, 4px) 0 !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="small__o8_Xq"] [class*="item__o8_Xq"] {\n    border-radius: var(--radius-round, 999px) 0 0 var(--radius-round, 999px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="rightCaret_1uD6uZ"],\nhtml[data-arabic-rtl="1"] [class*="arrow_5HupHs"] {\n    transform: rotate(90deg) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="leftCaret_1uD6uZ"],\nhtml[data-arabic-rtl="1"] [class*="filterIcon_JHplLf"] {\n    transform: rotate(-90deg) !important;\n}\n\nhtml[data-arabic-rtl="1"].enable-forced-colors [class*="embedFull_"] {\n    border-left-width: 0 !important;\n    border-right-width: 4px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="clipOverlayHeader_"] {\n    left: auto !important;\n    right: 0 !important;\n    transform-origin: top right !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="pttIndicator_"] {\n    right: auto !important;\n    left: 7px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="spine_"],\nhtml[data-arabic-rtl="1"] [class*="invertedSpine_"] {\n    transform: scaleX(-1);\n}\n\n/* \u0627\u0644\u062D\u0641\u0627\u0638 \u0639\u0644\u0649 \u062A\u0637\u0627\u0628\u0642 \u0634\u0627\u0631\u0627\u062A \u0627\u0644\u0633\u064A\u0631\u0641\u0631\u0627\u062A \u0648\u0627\u0644\u0623\u0641\u0627\u062A\u0627\u0631 \u0645\u0639 \u062B\u0642\u0648\u0628 \u0623\u0642\u0646\u0639\u0629 \u0627\u0644\u0640 SVG */\nhtml[data-arabic-rtl="1"] [class*="wrapper_XpIUHy"],\nhtml[data-arabic-rtl="1"] [class*="container_pfDcF-"],\nhtml[data-arabic-rtl="1"] [class*="wrapper_hqZPsU"],\nhtml[data-arabic-rtl="1"] [class*="root_vula7D"] {\n    direction: ltr !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="status_XpIUHy"] {\n    inset-inline-end: auto !important;\n    right: 0 !important;\n    left: auto !important;\n}\n\n/* \u0625\u0635\u0644\u0627\u062D \u062A\u0645\u0631\u0643\u0632 \u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u0629 \u0639\u0644\u0649 inset-inline-start: 50% \u0645\u0639 translate(-50%) \u0641\u064A RTL */\nhtml[data-arabic-rtl="1"] [class*="childContainer_d3vyhc"],\nhtml[data-arabic-rtl="1"] [class*="warning_RkOlfb"],\nhtml[data-arabic-rtl="1"] [class*="spinner_2Zx6d1"],\nhtml[data-arabic-rtl="1"] [class*="playButton_hzb1TJ"],\nhtml[data-arabic-rtl="1"] [class*="overlay_wWbLtM"],\nhtml[data-arabic-rtl="1"] [class*="nitroTopDividerLockCircle_"],\nhtml[data-arabic-rtl="1"] [class*="premiumUnlockAnimation_"],\nhtml[data-arabic-rtl="1"] [class*="premiumUnlockedWithNitroPillContainer_"],\nhtml[data-arabic-rtl="1"] [class*="nitroWumpusMobile_"],\nhtml[data-arabic-rtl="1"] [class*="overlayLabel_1399Om"],\nhtml[data-arabic-rtl="1"] [class*="ring_6i1vAy"],\nhtml[data-arabic-rtl="1"] [class*="staticWumpusWithTrinkets_"],\nhtml[data-arabic-rtl="1"] [class*="wowAnimation_t2lcaR"],\nhtml[data-arabic-rtl="1"] [class*="obscureWarning_"],\nhtml[data-arabic-rtl="1"] [class*="loadingSpinner_hFq1lM"][class*="centered_"],\nhtml[data-arabic-rtl="1"] [class*="playPausePopCont_"],\nhtml[data-arabic-rtl="1"] [class*="videoOverlayMessage_"],\nhtml[data-arabic-rtl="1"] [class*="waitingPill_"],\nhtml[data-arabic-rtl="1"] [class*="displayCountText_"],\nhtml[data-arabic-rtl="1"] [class*="orbWalletBlackFridayGlow_"],\nhtml[data-arabic-rtl="1"] [class*="glow_K9Xq13"],\nhtml[data-arabic-rtl="1"] [class*="resizeHandle_FOCwq3"]::after,\nhtml[data-arabic-rtl="1"] [class*="obscuredTag_"],\nhtml[data-arabic-rtl="1"] [class*="sizeGizmo_"],\nhtml[data-arabic-rtl="1"] [class*="glow_uWfwNv"],\nhtml[data-arabic-rtl="1"] [class*="headerTitle_5sqtjZ"],\nhtml[data-arabic-rtl="1"] [class*="nameplateGlow_"],\nhtml[data-arabic-rtl="1"] [class*="jumpingWumpusContainer_"],\nhtml[data-arabic-rtl="1"] [class*="previewPlayButtonCont_"],\nhtml[data-arabic-rtl="1"] [class*="addIcon_rrcttU"],\nhtml[data-arabic-rtl="1"] [class*="body_Wu0ZxP"],\nhtml[data-arabic-rtl="1"] [class*="videoWrapper_r1W-NV"],\nhtml[data-arabic-rtl="1"] [class*="cover_tTlCcY"],\nhtml[data-arabic-rtl="1"] [class*="headerGlow_3emZAO"],\nhtml[data-arabic-rtl="1"] [class*="overlayDebugContainer_"],\nhtml[data-arabic-rtl="1"] [class*="heroBannerSheenContainer_"],\nhtml[data-arabic-rtl="1"] [class*="body_7ne32W"],\nhtml[data-arabic-rtl="1"] [class*="playIcon_N34jMW"],\nhtml[data-arabic-rtl="1"] [class*="addIcon_Q8-jZj"],\nhtml[data-arabic-rtl="1"] [class*="rewardTooltip_"],\nhtml[data-arabic-rtl="1"] [class*="spinner_vYDVPJ"],\nhtml[data-arabic-rtl="1"] [class*="pill_KUkQ06"],\nhtml[data-arabic-rtl="1"] [class*="saveNoticeContainer_"],\nhtml[data-arabic-rtl="1"] [class*="mediaPlayer_RHUSWe"],\nhtml[data-arabic-rtl="1"] [class*="responsive_"][class*="bannerAsset_"],\nhtml[data-arabic-rtl="1"] [class*="editButton_2IR9L0"],\nhtml[data-arabic-rtl="1"] [class*="emptyState_fzU3RU"],\nhtml[data-arabic-rtl="1"] [class*="lockIconOverlay_"],\nhtml[data-arabic-rtl="1"] [class*="rewardContainerUnenrolled_"] > [class*="questRewardTile_"],\nhtml[data-arabic-rtl="1"] [class*="disabled_Ykwe0q"],\nhtml[data-arabic-rtl="1"] [class*="featureAssetLabel_"],\nhtml[data-arabic-rtl="1"] [class*="recommendedTierHighlightTag_"],\nhtml[data-arabic-rtl="1"] [class*="centerOrb_NUIl5Z"],\nhtml[data-arabic-rtl="1"] [class*="popoutRoot_"][class*="arrowAlignmentMiddle_"]::before,\nhtml[data-arabic-rtl="1"] [class*="popoutRoot_"][class*="arrowAlignmentTop_"]::before {\n    inset-inline-start: auto !important;\n    left: 50% !important;\n    right: auto !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="newPostsButton_"] {\n    inset-inline-end: auto !important;\n    right: 50% !important;\n    left: auto !important;\n}\n\n/* \u0625\u0635\u0644\u0627\u062D \u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u0625\u064A\u0645\u0648\u062C\u064A \u0648\u0627\u0644\u0645\u0644\u0635\u0642\u0627\u062A \u0648\u0627\u0644\u0640 GIF (Expression Picker) \u0648\u0645\u0646\u0639 \u062A\u0642\u0644\u0635\u0647\u0627 \u0648\u062A\u062F\u0627\u062E\u0644\u0647\u0627 \u0641\u064A RTL */\nhtml[data-arabic-rtl="1"] [class*="expressionPickerPositionLayer_"]:not([style*="left"]) {\n    left: var(--space-16, 16px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="positionLayerDefaultAlignRight_"]:not([style*="left"]) {\n    left: var(--space-16, 16px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="positionLayerDefaultAlignLeft_"]:not([style*="right"]) {\n    right: var(--space-16, 16px) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="drawerSizingWrapper_"][style*="right"] {\n    inset-inline-end: auto !important;\n    right: auto !important;\n    left: var(--space-16, 16px) !important;\n    max-width: calc(100% - var(--space-16, 16px));\n}\n\nhtml[data-arabic-rtl="1"] [class*="drawerSizingWrapper_"][style*="right"] [class*="resizeHandle_"] {\n    pointer-events: none;\n}\n\nhtml[data-arabic-rtl="1"] [class*="drawerSizingWrapper_"][style*="left"] {\n    inset-inline-end: auto !important;\n    right: auto !important;\n    left: var(--space-24, 24px) !important;\n    max-width: calc(100% - var(--space-24, 24px));\n}\n\nhtml[data-arabic-rtl="1"] [class*="drawerSizingWrapper_"] > [class*="contentWrapper_"] {\n    grid-template-columns: minmax(0, 1fr);\n    min-width: 0;\n    width: 100%;\n}\n\nhtml[data-arabic-rtl="1"] [class*="emojiPickerHasTabWrapper_"],\nhtml[data-arabic-rtl="1"] [class*="emojiPickerHasTabWrapper_"] [class*="emojiPicker_"],\nhtml[data-arabic-rtl="1"] [class*="wrapper_WSRqCO"],\nhtml[data-arabic-rtl="1"] [class*="gifPicker_-KEDVj"] {\n    min-width: 0;\n}\n\nhtml[data-arabic-rtl="1"] [class*="categoryList_-sZhZn"] [class*="scrollerBase_"],\nhtml[data-arabic-rtl="1"] [class*="categoryList_X9_kMu"] [class*="scrollerBase_"],\nhtml[data-arabic-rtl="1"] [class*="categoryList_40yGEf"] [class*="scrollerBase_"] {\n    padding-left: 0 !important;\n    padding-right: 8px !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="categoryPill_X9_kMu"],\nhtml[data-arabic-rtl="1"] [class*="categoryPill_40yGEf"] {\n    inset-inline-start: -8px !important;\n}\n\n/* \u0625\u0635\u0644\u0627\u062D \u0627\u0644\u0647\u0648\u0627\u0645\u0634 \u0648\u0627\u0644\u062D\u0634\u0648 \u0627\u0644\u0641\u064A\u0632\u064A\u0627\u0626\u064A \u0641\u064A \u0627\u0644\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0646\u0642\u0637\u064A\u0629 \u0648\u0639\u0646\u0627\u0648\u064A\u0646 \u0623\u0642\u0633\u0627\u0645 \u0627\u0644\u0642\u0648\u0627\u0626\u0645 */\nhtml[data-arabic-rtl="1"] [class*="list_XFAI1O"] {\n    margin-left: 0 !important;\n    margin-inline-start: var(--space-20) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="listBoxSectionHeader_"] {\n    padding-inline: var(--space-8) var(--space-4) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="transcriptContPortrait_"] {\n    inset-inline: auto !important;\n    right: auto !important;\n    left: 50% !important;\n}\n\n/* \u0625\u0635\u0644\u0627\u062D \u062A\u0628\u0648\u064A\u0628\u0627\u062A top_6zZYhF\u060C \u0648\u062D\u0634\u0648 \u0623\u0632\u0631\u0627\u0631 \u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0648\u0633\u0648\u0645 tag_6v0VwV\u060C \u0648\u0645\u0648\u0636\u0639 \u0635\u0648\u0631\u0629 \u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 */\nhtml[data-arabic-rtl="1"] [class*="top_6zZYhF"] [class*="item_6zZYhF"] + [class*="item_6zZYhF"] {\n    margin-left: 0 !important;\n    margin-inline-start: var(--space-xl) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="tag_"]:has([slot="remove"]) {\n    padding-inline: var(--space-12) var(--space-8) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="tagGroup_"][data-size="sm"] [class*="tag_"]:has([slot="remove"]),\nhtml[data-arabic-rtl="1"]\n    [class*="tagGroup_"][data-size="xs"]\n    [class*="tag_"]:has([slot="remove"]) {\n    padding-inline: var(--space-8) var(--space-4) !important;\n}\n\nhtml[data-arabic-rtl="1"] [class*="imageOffsetPositioner_"] {\n    border-top-right-radius: 0 !important;\n    border-top-left-radius: var(\n        --custom-application-widget-card-radius,\n        var(--radius-lg)\n    ) !important;\n    right: 0 !important;\n    left: calc(var(--space-16) * -1) !important;\n}\n\n/* \u0625\u0635\u0644\u0627\u062D \u0647\u0648\u0627\u0645\u0634 \u0632\u062E\u0627\u0631\u0641 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0639\u0636\u0627\u0621 \u0648\u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0648\u0645\u0644\u0635\u0642\u0627\u062A \u0627\u0644\u062A\u0648\u0642\u064A\u062A \u0648Spotify \u0641\u064A Vencord */\nhtml[data-arabic-rtl="1"] .vc-member-list-decorators-wrapper:not(:empty),\nhtml[data-arabic-rtl="1"] .vc-message-decorations-wrapper:not(:empty) {\n    margin-left: 0 !important;\n    margin-inline-start: 0.25em !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-st-raw-code {\n    margin-left: 0 !important;\n    margin-inline-start: 0.33rem !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-st-date-picker {\n    padding-inline: 12px 8px !important;\n}\n\nhtml[data-arabic-rtl="1"] .vc-spotify-tooltip-text {\n    padding-right: 0 !important;\n    padding-inline-end: 0.2em !important;\n}\n\n/* \u0625\u0628\u0642\u0627\u0621 \u0634\u0631\u064A\u0637 \u0627\u0644\u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u0639\u0644\u0648\u064A \u0648\u0623\u0634\u0631\u0637\u0629 \u0627\u0644\u062A\u0645\u0631\u064A\u0631 \u0648\u0627\u0644\u0645\u0641\u0627\u062A\u064A\u062D \u0648\u0627\u0644\u0623\u0643\u0648\u0627\u062F \u0648\u0627\u0644\u0623\u0648\u0642\u0627\u062A \u0648\u0627\u0644\u0634\u0627\u0631\u0627\u062A \u0627\u0644\u0631\u0642\u0645\u064A\u0629 \u0648\u0627\u0644\u0645\u0639\u0627\u062F\u0644\u0627\u062A \u0628\u0627\u0644\u0627\u062A\u062C\u0627\u0647 \u0627\u0644\u0635\u062D\u064A\u062D */\nhtml[data-arabic-rtl="1"] [class*="bar_"]:has([class*="winButtons_"]),\nhtml[data-arabic-rtl="1"] [class*="titleBar_"],\nhtml[data-arabic-rtl="1"] [class*="winButtons_"],\nhtml[data-arabic-rtl="1"] [role="slider"],\nhtml[data-arabic-rtl="1"] [class*="slider_"],\nhtml[data-arabic-rtl="1"] [class*="mediaBar"],\nhtml[data-arabic-rtl="1"] #vc-spotify-progress-bar,\nhtml[data-arabic-rtl="1"] .vc-spotify-button-row,\nhtml[data-arabic-rtl="1"] [class*="keybindShortcut_"],\nhtml[data-arabic-rtl="1"] [class*="keyComboInner_"],\nhtml[data-arabic-rtl="1"] [class*="combo_"]:has([class*="key_"]),\nhtml[data-arabic-rtl="1"] [class*="shortcut_"]:has([class*="key_"]),\nhtml[data-arabic-rtl="1"] .vc-switch-container,\nhtml[data-arabic-rtl="1"] .vc-shiki-container,\nhtml[data-arabic-rtl="1"] .katex,\nhtml[data-arabic-rtl="1"] pre,\nhtml[data-arabic-rtl="1"] code,\nhtml[data-arabic-rtl="1"] kbd,\nhtml[data-arabic-rtl="1"] [class*="codeBlockText_"],\nhtml[data-arabic-rtl="1"] [class*="inlineCode_"],\nhtml[data-arabic-rtl="1"] [class*="commandName_"],\nhtml[data-arabic-rtl="1"] [class*="popularCommands_"] [class*="command_"],\nhtml[data-arabic-rtl="1"] [class*="commandTag_"],\nhtml[data-arabic-rtl="1"] [class*="numberBadge_"],\nhtml[data-arabic-rtl="1"] [class*="mentionsBadge_"],\nhtml[data-arabic-rtl="1"] [class*="userTag_C2XpHA"],\nhtml[data-arabic-rtl="1"]\n    [class*="userTag_"]:has([class*="discriminator_"]):not([class*="discordTag_"]) {\n    direction: ltr !important;\n    unicode-bidi: isolate;\n}\n\n/* \u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u062A\u0648\u0627\u0631\u064A\u062E \u0648\u0627\u0644\u0623\u0648\u0642\u0627\u062A \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0648\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0628\u0634\u0643\u0644 \u0635\u062D\u064A\u062D \u0628\u062F\u0648\u0646 \u062A\u062F\u0627\u062E\u0644 \u0623\u0648 \u0627\u0646\u0639\u0643\u0627\u0633 */\nhtml[data-arabic-rtl="1"] time,\nhtml[data-arabic-rtl="1"] [class*="timestamp_"] {\n    unicode-bidi: plaintext !important;\n}\n\n/* \u0627\u0644\u0631\u0648\u0627\u0628\u0637 \u062A\u062A\u0628\u0639 \u0644\u063A\u062A\u0647\u0627 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0628\u062F\u0648\u0646 \u0625\u062C\u0628\u0627\u0631 \u0627\u0644\u0631\u0648\u0627\u0628\u0637 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0639\u0644\u0649 LTR */\nhtml[data-arabic-rtl="1"] a[href] {\n    unicode-bidi: plaintext;\n}\n';

// src/userplugins/arabicDiscord/validation.mjs
var VALID_PLURAL_CATEGORIES = /* @__PURE__ */ new Set(["zero", "one", "two", "few", "many", "other"]);
var MAX_AST_DEPTH = 32;
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isValidAstNode(node, onIssue, depth = 0) {
  if (depth > MAX_AST_DEPTH) {
    return false;
  }
  if (typeof node === "string") {
    onIssue?.(node);
    return true;
  }
  if (!Array.isArray(node) || node.length === 0) {
    return false;
  }
  const kind = node[0];
  if (typeof kind !== "number" || !Number.isInteger(kind) || kind < 1 || kind > 8) {
    return false;
  }
  if (kind === 7) {
    return node.length === 1;
  }
  if (typeof node[1] !== "string" || node[1].length === 0) {
    return false;
  }
  if (kind === 1) {
    return node.length === 2;
  }
  if (kind === 2 || kind === 3 || kind === 4) {
    return node.length === 2 || node.length === 3 && typeof node[2] === "string";
  }
  if (kind === 5 || kind === 6) {
    if (kind === 5 && node.length !== 3) return false;
    if (kind === 6) {
      if (node.length !== 5) return false;
      if (typeof node[3] !== "number" || !Number.isInteger(node[3])) return false;
      if (node[4] !== "cardinal" && node[4] !== "ordinal") return false;
    }
    const branches = node[2];
    if (!isPlainObject(branches)) return false;
    if (kind === 6 && !Object.prototype.hasOwnProperty.call(branches, "other")) {
      return false;
    }
    const entries = Object.entries(branches);
    if (entries.length === 0) return false;
    for (const [cat, branchNodes] of entries) {
      if (kind === 6 && !VALID_PLURAL_CATEGORIES.has(cat) && !/^=-?\d+$/.test(cat)) {
        return false;
      }
      if (!Array.isArray(branchNodes)) return false;
      for (const child of branchNodes) {
        if (!isValidAstNode(child, onIssue, depth + 1)) return false;
      }
    }
    return true;
  }
  if (kind === 8) {
    if (node.length !== 3 && node.length !== 4) return false;
    if (!Array.isArray(node[2])) return false;
    if (node.length === 4 && !Array.isArray(node[3])) return false;
    for (const child of node[2]) {
      if (!isValidAstNode(child, onIssue, depth + 1)) return false;
    }
    if (node.length === 4) {
      for (const child of node[3]) {
        if (!isValidAstNode(child, onIssue, depth + 1)) return false;
      }
    }
    return true;
  }
  return false;
}
function isValidDictionaries(arJson, complexJson) {
  if (!isPlainObject(arJson) || !isPlainObject(complexJson)) return false;
  if (!isPlainObject(arJson.byText)) return false;
  if (arJson.byKey != null && !isPlainObject(arJson.byKey)) return false;
  const textEntries = Object.values(arJson.byText);
  const complexEntries = Object.values(complexJson);
  if (textEntries.length < 100 || complexEntries.length < 100) return false;
  for (const v of textEntries) {
    if (typeof v !== "string" || !v.trim()) return false;
  }
  if (arJson.byKey) {
    for (const v of Object.values(arJson.byKey)) {
      if (typeof v !== "string" || !v.trim()) return false;
    }
  }
  for (const ast of complexEntries) {
    if (!Array.isArray(ast)) return false;
    for (const node of ast) {
      if (!isValidAstNode(node)) return false;
    }
  }
  return true;
}

// src/userplugins/arabicDiscord/index.tsx
var logger = new Logger("ArabicDiscord");
var REMOTE_REPO_BASE = "https://raw.githubusercontent.com/7madh1/ArabicDiscord/main";
var REMOTE_AR_URL = `${REMOTE_REPO_BASE}/ar.json`;
var REMOTE_COMPLEX_URL = `${REMOTE_REPO_BASE}/complex_ar.json`;
var DS_AR_KEY = "ArabicDiscord_ar_v1";
var DS_COMPLEX_KEY = "ArabicDiscord_complex_v1";
var DS_META_KEY = "ArabicDiscord_meta_v1";
var UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1e3;
var activeDict = {};
var complexArMap = /* @__PURE__ */ new Map();
var isCheckingRemoteUpdates = false;
var lifecycleGeneration = 0;
var activeFetchController = null;
var storageWriteChain = Promise.resolve();
function persistDictionariesQueued(gen, entries) {
  let wrote = false;
  const task = storageWriteChain.then(async () => {
    if (!active || gen !== lifecycleGeneration) {
      return;
    }
    await setMany(entries);
    wrote = true;
  });
  storageWriteChain = task.then(
    () => void 0,
    () => void 0
  );
  return task.then(() => wrote);
}
var seenUntranslated = /* @__PURE__ */ new Set();
var HAS_LATIN_RE = /[A-Za-z]/;
var HAS_DIGIT_RE = /\d/;
var NEEDS_NORM_RE = /[\u2018\u2019\u201C\u201D\n\r\t]|\s{2,}/;
var FONT_LINK_ID = "vc-arabic-font-link";
var LOOKUP_CACHE_LIMIT = 4096;
var ARABIC_FONTS = [
  {
    id: "cairo",
    label: "Cairo (\u0639\u0635\u0631\u064A \u0648\u0648\u0627\u0636\u062D)",
    stack: '"Cairo", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
    googleFamily: "Cairo:wght@400;500;600;700;800",
    default: true
  },
  {
    id: "tajawal",
    label: "Tajawal (\u0646\u0627\u0639\u0645 \u0648\u0645\u0631\u064A\u062D)",
    stack: '"Tajawal", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
    googleFamily: "Tajawal:wght@400;500;700"
  },
  {
    id: "almarai",
    label: "Almarai (\u0623\u0646\u064A\u0642 \u0648\u0645\u062A\u0646\u0627\u0633\u0642)",
    stack: '"Almarai", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
    googleFamily: "Almarai:wght@400;700;800"
  },
  {
    id: "alexandria",
    label: "Alexandria (\u0647\u0646\u062F\u0633\u064A \u0639\u0635\u0631\u064A)",
    stack: '"Alexandria", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
    googleFamily: "Alexandria:wght@400;500;600;700"
  },
  {
    id: "ibm",
    label: "IBM Plex Sans Arabic (\u0627\u062D\u062A\u0631\u0627\u0641\u064A)",
    stack: '"IBM Plex Sans Arabic", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
    googleFamily: "IBM+Plex+Sans+Arabic:wght@400;500;600;700"
  },
  {
    id: "noto",
    label: "Noto Sans Arabic (\u0631\u0633\u0645\u064A \u0648\u0645\u062A\u0648\u0627\u0632\u0646)",
    stack: '"Noto Sans Arabic", "gg sans", "Segoe UI", sans-serif',
    googleFamily: "Noto+Sans+Arabic:wght@400;500;600;700"
  },
  {
    id: "readex",
    label: "Readex Pro (\u062A\u0642\u0646\u064A \u0648\u0646\u0638\u064A\u0641)",
    stack: '"Readex Pro", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
    googleFamily: "Readex+Pro:wght@400;500;600;700"
  },
  {
    id: "rubik",
    label: "Rubik (\u062F\u0627\u0626\u0631\u064A \u0648\u0645\u0648\u062F\u0631\u0646)",
    stack: '"Rubik", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
    googleFamily: "Rubik:wght@400;500;600;700"
  },
  {
    id: "vazirmatn",
    label: "Vazirmatn (\u0645\u0636\u063A\u0648\u0637 \u0644\u0644\u0634\u0627\u0634\u0627\u062A)",
    stack: '"Vazirmatn", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
    googleFamily: "Vazirmatn:wght@400;500;600;700"
  },
  {
    id: "changa",
    label: "Changa (\u0639\u0631\u064A\u0636 \u0648\u062C\u0631\u064A\u0621)",
    stack: '"Changa", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
    googleFamily: "Changa:wght@400;500;600;700"
  },
  {
    id: "messiri",
    label: "El Messiri (\u062C\u0645\u0627\u0644\u064A \u0648\u0623\u0646\u064A\u0642)",
    stack: '"El Messiri", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
    googleFamily: "El+Messiri:wght@400;500;600;700"
  },
  {
    id: "kufi",
    label: "Noto Kufi Arabic (\u0643\u0648\u0641\u064A \u062D\u062F\u064A\u062B)",
    stack: '"Noto Kufi Arabic", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
    googleFamily: "Noto+Kufi+Arabic:wght@400;500;600;700"
  },
  {
    id: "zain",
    label: "Zain (\u0627\u0646\u0633\u064A\u0627\u0628\u064A \u0648\u0645\u0645\u064A\u0632)",
    stack: '"Zain", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
    googleFamily: "Zain:wght@400;700;800"
  },
  {
    id: "system",
    label: "\u062E\u0637 \u0627\u0644\u0646\u0638\u0627\u0645 (Segoe UI)",
    stack: '"Segoe UI", Tahoma, "gg sans", sans-serif',
    googleFamily: null
  }
];
var ARABIC_FONT_MAP = new Map(ARABIC_FONTS.map((f) => [f.id, f]));
var DEFAULT_ARABIC_FONT = ARABIC_FONTS[0];
var lookupCache = /* @__PURE__ */ new Map();
var translatedNodeValues = /* @__PURE__ */ new WeakMap();
var translatedPlaceholders = /* @__PURE__ */ new WeakMap();
var cachedLookups = null;
var stopDomFallbackFn = null;
function exportUntranslatedToFile() {
  const dump = {};
  const lookups = cachedLookups ?? buildTranslationLookups();
  const allCachedKeys = Object.keys(i18n?.t ?? {});
  const strFn = patchedTargets[0]?.originals.string ?? i18n?.intl?.string;
  for (const hash2 of allCachedKeys) {
    try {
      const text = strFn?.call(i18n.intl, i18n.t[hash2]);
      if (typeof text === "string" && text.trim() && !lookupString(text, lookups)) {
        dump[text] = "";
      }
    } catch {
    }
  }
  for (const text of seenUntranslated) {
    if (!lookupString(text, lookups)) {
      dump[text] = "";
    }
  }
  const count = Object.keys(dump).length;
  const blob = new Blob([JSON.stringify(dump, null, 4)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "discord_untranslated.json";
  a.click();
  URL.revokeObjectURL(url);
  logger.info(`Exported ${count} untranslated strings.`);
  return count;
}
function ActionsPanel() {
  const simpleCount = Object.keys(activeDict.byText ?? {}).length;
  const complexCount = complexArMap.size;
  const [capturedCount, setCapturedCount] = React.useState(seenUntranslated.size);
  return /* @__PURE__ */ React.createElement("div", { className: "vc-arabic-actions-card" }, /* @__PURE__ */ React.createElement(StubComponent, { flexDirection: "column", gap: "0.75em" }, /* @__PURE__ */ React.createElement(StubComponent, { size: "md", weight: "semibold", style: { color: "var(--text-strong)" } }, "\u062D\u0627\u0644\u0629 \u0627\u0644\u0642\u0627\u0645\u0648\u0633 \u0648\u0627\u0644\u0623\u062F\u0648\u0627\u062A \u0627\u0644\u0633\u0631\u064A\u0639\u0629"), /* @__PURE__ */ React.createElement("div", { className: "vc-arabic-stats-row" }, /* @__PURE__ */ React.createElement("span", { className: "vc-arabic-stat-pill" }, "\u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0628\u0633\u064A\u0637\u0629: ", simpleCount.toLocaleString("en-US")), /* @__PURE__ */ React.createElement("span", { className: "vc-arabic-stat-pill" }, "\u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u0645\u0639\u0642\u062F\u0629: ", complexCount.toLocaleString("en-US")), /* @__PURE__ */ React.createElement("span", { className: "vc-arabic-stat-pill" }, "\u0645\u0631\u0635\u0648\u062F \u062D\u0627\u0644\u064A\u0627\u064B: ", capturedCount)), /* @__PURE__ */ React.createElement(StubComponent, { gap: "0.65em", style: { flexWrap: "wrap", marginTop: "0.25em" } }, /* @__PURE__ */ React.createElement(
    StubComponent,
    {
      variant: "primary",
      size: "small",
      onClick: () => {
        const count = exportUntranslatedToFile();
        setCapturedCount(seenUntranslated.size);
        showToast({
          text: `\u062A\u0645 \u062A\u0635\u062F\u064A\u0631 ${count} \u0646\u0635 \u063A\u064A\u0631 \u0645\u062A\u0631\u062C\u0645`,
          variant: "success"
        });
      }
    },
    "\u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0646\u0635\u0648\u0635 \u063A\u064A\u0631 \u0627\u0644\u0645\u062A\u0631\u062C\u0645\u0629 (JSON)"
  ), capturedCount > 0 && /* @__PURE__ */ React.createElement(
    StubComponent,
    {
      variant: "secondary",
      size: "small",
      onClick: () => {
        seenUntranslated.clear();
        setCapturedCount(0);
        showToast({ text: "\u062A\u0645 \u0645\u0633\u062D \u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0645\u0631\u0635\u0648\u062F\u0629", variant: "success" });
      }
    },
    "\u0645\u0633\u062D \u0627\u0644\u0645\u0631\u0635\u0648\u062F"
  ), /* @__PURE__ */ React.createElement(StubComponent, { variant: "secondary", size: "small", onClick: () => location.reload() }, "\u0625\u0639\u0627\u062F\u0629 \u062A\u062D\u0645\u064A\u0644 \u062F\u064A\u0633\u0643\u0648\u0631\u062F"))));
}
var settings = definePluginSettings({
  arabicFont: {
    type: OptionType.SELECT,
    displayName: "Arabic Font",
    description: "Choose the font used for Arabic UI and text",
    options: ARABIC_FONTS.map((f) => ({
      label: f.label,
      value: f.id,
      default: f.default
    })),
    onChange: applyStylesFromSettings
  },
  fontScale: {
    type: OptionType.SLIDER,
    displayName: "Font Size",
    description: "Scale Arabic UI text size (%)",
    markers: [90, 95, 100, 105, 110, 115, 120],
    default: 100,
    stickToMarkers: false,
    onChange: applyStylesFromSettings
  },
  enableRtl: {
    type: OptionType.BOOLEAN,
    displayName: "Enable Full RTL Layout",
    description: "Mirror Discord menus and windows from right to left",
    default: false,
    onChange: applyStylesFromSettings
  },
  captureUntranslated: {
    type: OptionType.BOOLEAN,
    displayName: "Capture Untranslated Strings",
    description: "Log newly spotted English strings while browsing Discord",
    default: false,
    hidden: true
  },
  quickTools: {
    type: OptionType.COMPONENT,
    component: ActionsPanel,
    hidden: true
  }
});
var ARABIC_MONTHS = [
  "\u064A\u0646\u0627\u064A\u0631",
  "\u0641\u0628\u0631\u0627\u064A\u0631",
  "\u0645\u0627\u0631\u0633",
  "\u0623\u0628\u0631\u064A\u0644",
  "\u0645\u0627\u064A\u0648",
  "\u064A\u0648\u0646\u064A\u0648",
  "\u064A\u0648\u0644\u064A\u0648",
  "\u0623\u063A\u0633\u0637\u0633",
  "\u0633\u0628\u062A\u0645\u0628\u0631",
  "\u0623\u0643\u062A\u0648\u0628\u0631",
  "\u0646\u0648\u0641\u0645\u0628\u0631",
  "\u062F\u064A\u0633\u0645\u0628\u0631"
];
var ARABIC_WEEKDAYS = ["\u0627\u0644\u0623\u062D\u062F", "\u0627\u0644\u0625\u062B\u0646\u064A\u0646", "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621", "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621", "\u0627\u0644\u062E\u0645\u064A\u0633", "\u0627\u0644\u062C\u0645\u0639\u0629", "\u0627\u0644\u0633\u0628\u062A"];
var ARABIC_WEEKDAYS_SHORT = ["\u0623\u062D\u062F", "\u0625\u062B\u0646\u064A\u0646", "\u062B\u0644\u0627\u062B\u0627\u0621", "\u0623\u0631\u0628\u0639\u0627\u0621", "\u062E\u0645\u064A\u0633", "\u062C\u0645\u0639\u0629", "\u0633\u0628\u062A"];
var ARABIC_DATE_LOCALE = "ar-u-nu-latn";
var prevMomentLocale = null;
var prevIntlLocale = null;
var arabicLocaleDefined = false;
var patchedDateFormatters = [];
var isSyncingDateLocale = false;
function patchNativeDateFormatter() {
  if (!active) return false;
  const candidates = [
    window.DiscordNative?.nativeModules?.requireModule?.("discord_utils")
  ];
  try {
    const mod = find((m) => typeof m?.getDiscordUtils === "function");
    candidates.push(mod?.getDiscordUtils?.());
  } catch {
  }
  let patchedAny = false;
  for (const utils of candidates) {
    if (!utils || typeof utils.createDateFormatter !== "function" || patchedDateFormatters.some((p) => p.target === utils)) {
      continue;
    }
    const orig = utils.createDateFormatter;
    patchedDateFormatters.push({ target: utils, orig });
    utils.createDateFormatter = function(locale, opts) {
      if (active) {
        try {
          const fmt = new Intl.DateTimeFormat(ARABIC_DATE_LOCALE, opts);
          return (date) => fmt.format(date).replace(/\u200f/g, "");
        } catch {
        }
      }
      return orig.call(this, locale, opts);
    };
    patchedAny = true;
  }
  return patchedAny;
}
function restoreNativeDateFormatter() {
  const restored = patchedDateFormatters.length > 0;
  while (patchedDateFormatters.length > 0) {
    const entry = patchedDateFormatters.pop();
    entry.target.createDateFormatter = entry.orig;
  }
  return restored;
}
function formatArabicUnit(n, single, dual, few, many, display = String(n)) {
  if (n === 1) return single;
  if (n === 2) return dual;
  const mod100 = n % 100;
  if (mod100 >= 3 && mod100 <= 10) return `${display} ${few}`;
  return `${display} ${many}`;
}
function applyArabicMomentLocale() {
  try {
    if (!moment || typeof moment.locale !== "function") return false;
    const enableDates = active;
    if (enableDates) {
      if (!prevMomentLocale || prevMomentLocale === "ar-discord") {
        const cur = moment.locale();
        prevMomentLocale = cur && cur !== "ar-discord" ? cur : "en";
      }
      if (!arabicLocaleDefined) {
        moment.defineLocale("ar-discord", {
          months: ARABIC_MONTHS,
          monthsShort: ARABIC_MONTHS,
          weekdays: ARABIC_WEEKDAYS,
          weekdaysShort: ARABIC_WEEKDAYS_SHORT,
          weekdaysMin: ["\u062D", "\u0646", "\u062B", "\u0631", "\u062E", "\u062C", "\u0633"],
          longDateFormat: {
            LT: "h:mm A",
            LTS: "h:mm:ss A",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY h:mm A",
            LLLL: "dddd D MMMM YYYY h:mm A"
          },
          meridiemParse: /[صم]/,
          isPM: (input) => input === "\u0645",
          meridiem: (hour) => hour < 12 ? "\u0635" : "\u0645",
          calendar: {
            sameDay: "[\u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0633\u0627\u0639\u0629] LT",
            nextDay: "[\u063A\u062F\u0627\u064B \u0627\u0644\u0633\u0627\u0639\u0629] LT",
            nextWeek: "dddd [\u0627\u0644\u0633\u0627\u0639\u0629] LT",
            lastDay: "[\u0623\u0645\u0633 \u0627\u0644\u0633\u0627\u0639\u0629] LT",
            lastWeek: "dddd \u0627\u0644\u0645\u0627\u0636\u064A [\u0627\u0644\u0633\u0627\u0639\u0629] LT",
            sameElse: "L"
          },
          relativeTime: {
            future: "\u062E\u0644\u0627\u0644 %s",
            past: "\u0645\u0646\u0630 %s",
            s: "\u062B\u0648\u0627\u0646\u064D",
            ss: (n) => formatArabicUnit(n, "\u062B\u0627\u0646\u064A\u0629", "\u062B\u0627\u0646\u064A\u062A\u064A\u0646", "\u062B\u0648\u0627\u0646\u064D", "\u062B\u0627\u0646\u064A\u0629"),
            m: "\u062F\u0642\u064A\u0642\u0629",
            mm: (n) => formatArabicUnit(n, "\u062F\u0642\u064A\u0642\u0629", "\u062F\u0642\u064A\u0642\u062A\u064A\u0646", "\u062F\u0642\u0627\u0626\u0642", "\u062F\u0642\u064A\u0642\u0629"),
            h: "\u0633\u0627\u0639\u0629",
            hh: (n) => formatArabicUnit(n, "\u0633\u0627\u0639\u0629", "\u0633\u0627\u0639\u062A\u064A\u0646", "\u0633\u0627\u0639\u0627\u062A", "\u0633\u0627\u0639\u0629"),
            d: "\u064A\u0648\u0645",
            dd: (n) => formatArabicUnit(n, "\u064A\u0648\u0645", "\u064A\u0648\u0645\u064A\u0646", "\u0623\u064A\u0627\u0645", "\u064A\u0648\u0645\u064B\u0627"),
            M: "\u0634\u0647\u0631",
            MM: (n) => formatArabicUnit(n, "\u0634\u0647\u0631", "\u0634\u0647\u0631\u064A\u0646", "\u0623\u0634\u0647\u0631", "\u0634\u0647\u0631\u064B\u0627"),
            y: "\u0633\u0646\u0629",
            yy: (n) => formatArabicUnit(n, "\u0633\u0646\u0629", "\u0633\u0646\u062A\u064A\u0646", "\u0633\u0646\u0648\u0627\u062A", "\u0633\u0646\u0629")
          }
        });
        arabicLocaleDefined = true;
      }
      if (moment.locale() !== "ar-discord") {
        moment.locale("ar-discord");
        return true;
      }
    } else if (prevMomentLocale) {
      const targetLocale = prevMomentLocale;
      prevMomentLocale = null;
      if (moment.locale() !== targetLocale) {
        moment.locale(targetLocale);
        return true;
      }
    }
  } catch {
  }
  return false;
}
function applyArabicDateSystem(forceEmit = false) {
  if (isSyncingDateLocale) return;
  isSyncingDateLocale = true;
  try {
    const enableDates = active;
    let changed = enableDates ? patchNativeDateFormatter() : restoreNativeDateFormatter();
    if (applyArabicMomentLocale()) changed = true;
    const intlObj = i18n?.intl;
    if (intlObj && typeof intlObj.setLocale === "function") {
      if (enableDates) {
        if (!prevIntlLocale && intlObj.currentLocale && intlObj.currentLocale !== ARABIC_DATE_LOCALE) {
          prevIntlLocale = intlObj.currentLocale;
        }
        if (intlObj.currentLocale !== ARABIC_DATE_LOCALE) {
          intlObj.setLocale(ARABIC_DATE_LOCALE);
          changed = true;
        }
      } else if (prevIntlLocale) {
        const targetIntlLocale = prevIntlLocale;
        prevIntlLocale = null;
        if (intlObj.currentLocale === ARABIC_DATE_LOCALE) {
          intlObj.setLocale(targetIntlLocale);
          changed = true;
        }
      }
    }
    if (changed || forceEmit && enableDates) {
      try {
        const store = LocaleStore;
        store?._changeCallbacks?.invokeAll?.();
        store?.emitChange?.();
      } catch {
      }
    }
  } finally {
    isSyncingDateLocale = false;
  }
}
var onDiscordLocaleFlux = () => {
  if (!active) return;
  queueMicrotask(() => {
    if (active) {
      applyArabicDateSystem();
    }
  });
};
var dateSyncTimeoutId = null;
var isApplyingRootStyles = false;
var rootAttrObserver = null;
function syncArabicFontLink(googleFamily) {
  const { head } = document;
  if (!head) return;
  const existing = document.getElementById(FONT_LINK_ID);
  if (!googleFamily) {
    existing?.remove();
    return;
  }
  const href = `https://fonts.googleapis.com/css2?family=${googleFamily}&display=swap`;
  if (existing) {
    if (existing.getAttribute("href") !== href) {
      existing.setAttribute("href", href);
    }
    return;
  }
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = href;
  head.appendChild(link);
}
function getSelectedFontDef() {
  return ARABIC_FONT_MAP.get(settings.store.arabicFont || "cairo") ?? DEFAULT_ARABIC_FONT;
}
function applyStylesFromSettings() {
  const root = document.documentElement;
  if (!root || isApplyingRootStyles) return;
  isApplyingRootStyles = true;
  try {
    const fontDef = getSelectedFontDef();
    root.setAttribute("data-arabic-font", fontDef.id);
    root.style.setProperty("--arabic-font-stack", fontDef.stack);
    syncArabicFontLink(fontDef.googleFamily);
    const scale = Number(settings.store.fontScale) || 100;
    if (scale !== 100) {
      root.setAttribute("data-arabic-scale-active", "1");
      root.style.setProperty("--arabic-font-scale", `${scale}%`);
    } else {
      root.removeAttribute("data-arabic-scale-active");
      root.style.removeProperty("--arabic-font-scale");
    }
    const wasRtl = root.getAttribute("data-arabic-rtl") === "1";
    if (settings.store.enableRtl) {
      root.setAttribute("data-arabic-rtl", "1");
      root.setAttribute("dir", "rtl");
      if (!wasRtl && document.body) {
        syncAutoDirInSubtree(document.body);
      }
    } else {
      root.removeAttribute("data-arabic-rtl");
      root.setAttribute("dir", "ltr");
      if (wasRtl) {
        clearAutoDirAttrs();
      }
    }
  } finally {
    isApplyingRootStyles = false;
  }
}
function startRootAttrGuard() {
  const root = document.documentElement;
  if (!root || rootAttrObserver) return;
  rootAttrObserver = new MutationObserver(() => {
    if (!active || isApplyingRootStyles) return;
    const wantRtl = Boolean(settings.store.enableRtl);
    const fontDef = getSelectedFontDef();
    const hasRtlAttr = root.getAttribute("data-arabic-rtl") === "1";
    const dirOk = root.getAttribute("dir") === (wantRtl ? "rtl" : "ltr");
    const fontOk = root.getAttribute("data-arabic-font") === fontDef.id;
    const stackOk = root.style.getPropertyValue("--arabic-font-stack") === fontDef.stack;
    if (hasRtlAttr !== wantRtl || !dirOk || !fontOk || !stackOk) {
      applyStylesFromSettings();
    }
  });
  rootAttrObserver.observe(root, {
    attributes: true,
    attributeFilter: ["dir", "style", "data-arabic-rtl", "data-arabic-font"]
  });
}
function clearStyles() {
  const root = document.documentElement;
  document.getElementById(FONT_LINK_ID)?.remove();
  clearAutoDirAttrs();
  if (!root) return;
  isApplyingRootStyles = true;
  try {
    root.removeAttribute("data-arabic-font");
    root.removeAttribute("data-arabic-scale-active");
    root.removeAttribute("data-arabic-rtl");
    root.setAttribute("dir", "ltr");
    root.style.removeProperty("--arabic-font-scale");
    root.style.removeProperty("--arabic-font-stack");
  } finally {
    isApplyingRootStyles = false;
  }
}
function formatPlainTemplate(template, values) {
  if (!values) return template;
  return template.replace(
    /\{(\w+)\}/g,
    (full, key) => Object.hasOwn(values, key) ? String(values[key]) : full
  );
}
function formatRichTemplate(template, values) {
  if (!values) return template;
  const entries = Object.values(values);
  const hasNonPrimitive = entries.some(
    (v) => v !== null && (typeof v === "object" || typeof v === "function")
  );
  if (!hasNonPrimitive) {
    return formatPlainTemplate(template, values);
  }
  const parts = [];
  const regex = /\{(\w+)\}/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push(template.slice(lastIndex, match.index));
    }
    const key = match[1];
    parts.push(Object.hasOwn(values, key) ? values[key] : match[0]);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < template.length) {
    parts.push(template.slice(lastIndex));
  }
  return parts;
}
var patchedTargets = [];
var byAccessor = /* @__PURE__ */ new WeakMap();
var active = false;
var domObserver = null;
function normalizeText(text) {
  const trimmed = text.trim();
  if (!trimmed || !NEEDS_NORM_RE.test(trimmed)) return trimmed;
  return trimmed.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, " ");
}
function resolveKeyToHash(key) {
  return key.startsWith("#") ? key.slice(1) : runtimeHashMessageKey(key);
}
function getStaticLookups() {
  if (cachedLookups) return cachedLookups;
  const { byText } = activeDict;
  const byTextMap = /* @__PURE__ */ new Map();
  for (const [enText, arText] of Object.entries(byText ?? {})) {
    if (!arText || arText === enText) continue;
    byTextMap.set(enText, arText);
  }
  cachedLookups = { byTextMap, byNormMap: null };
  return cachedLookups;
}
function getNormLookupMap(lookups) {
  if (lookups.byNormMap) return lookups.byNormMap;
  const byNormMap = /* @__PURE__ */ new Map();
  for (const [enText, arText] of lookups.byTextMap) {
    const norm = normalizeText(enText).toLowerCase();
    if (norm.length >= 4 && !byNormMap.has(norm)) {
      byNormMap.set(norm, arText);
    }
  }
  lookups.byNormMap = byNormMap;
  return byNormMap;
}
function populateKeyAccessors() {
  const { byKey } = activeDict;
  if (!byKey || !i18n?.t) return;
  for (const [rawKey, arText] of Object.entries(byKey)) {
    if (!arText) continue;
    const hash2 = resolveKeyToHash(rawKey);
    try {
      const accessor = i18n.t[hash2];
      if (accessor && (typeof accessor === "function" || typeof accessor === "object") && !byAccessor.has(accessor)) {
        byAccessor.set(accessor, arText);
      }
    } catch {
    }
  }
}
function buildTranslationLookups() {
  const lookups = getStaticLookups();
  populateKeyAccessors();
  return lookups;
}
var DYNAMIC_NUMBER_PATTERNS = [
  [/^Save (\d+%) on Nitro$/i, "\u0648\u0641\u0651\u0631 $1 \u0639\u0644\u0649 \u0646\u064A\u062A\u0631\u0648"],
  [/^(\d+%) DISCOUNT$/i, "\u062E\u0635\u0645 $1"],
  [/^(\d+%) OFF$/i, "\u062E\u0635\u0645 $1"],
  [/^Get (\d+%) off (.+) items!$/i, "\u0627\u062D\u0635\u0644 \u0639\u0644\u0649 \u062E\u0635\u0645 $1 \u0639\u0644\u0649 \u0639\u0646\u0627\u0635\u0631 $2!"],
  [/^(\d+\/\d+) Boosts$/i, "$1 \u062A\u0639\u0632\u064A\u0632"],
  [/^Level (\d+)$/i, "\u0627\u0644\u0645\u0633\u062A\u0648\u0649 $1"],
  [/^Manage Members \(([\d,]+)\)$/i, "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u0639\u0636\u0627\u0621 ($1)"],
  [/^Roles\s*[–-]\s*([\d,]+)$/i, "\u0627\u0644\u0623\u062F\u0648\u0627\u0631 \u2013 $1"],
  [/^Members:\s*([\d,]+)$/i, "\u0627\u0644\u0623\u0639\u0636\u0627\u0621: $1"],
  [/^Online:\s*([\d,]+)$/i, "\u0627\u0644\u0645\u062A\u0635\u0644\u0648\u0646: $1"],
  [/^([\d,]+) Online$/i, "$1 \u0645\u062A\u0635\u0644"],
  [/^View ([\d,]+) more$/i, "\u0639\u0631\u0636 $1 \u0627\u0644\u0645\u0632\u064A\u062F"],
  [/^Earn ([\d,]+) Orbs$/i, "\u0627\u0643\u0633\u0628 $1 \u0643\u0631\u0629"],
  [/^([\d,]+) Orbs redeemed all time$/i, "\u062A\u0645 \u0627\u0633\u062A\u0628\u062F\u0627\u0644 $1 \u0643\u0631\u0629 \u0625\u062C\u0645\u0627\u0644\u0627\u064B"],
  [/^Unlock\s+(\d+(?:\.\d+)?)\s*x$/i, "\u0627\u0641\u062A\u062D \u0645\u0636\u0627\u0639\u0641\u0629 $1\xD7"],
  [/^(\d+(?:\.\d+)?)\s*x$/i, "$1\xD7"],
  [/^Send\s+([\d,]+)\s+gifts?\s+to\s+unlock\s+this\s+badge\.?$/i, "\u0623\u0631\u0633\u0644 $1 \u0647\u062F\u0627\u064A\u0627 \u0644\u0641\u062A\u062D \u0647\u0630\u0647 \u0627\u0644\u0634\u0627\u0631\u0629."],
  [/^Boost\s+([\d,]+)\s+servers?\s+to\s+unlock\s+this\s+badge\.?$/i, "\u0639\u0632\u0651\u0632 $1 \u0633\u064A\u0631\u0641\u0631\u0627\u062A \u0644\u0641\u062A\u062D \u0647\u0630\u0647 \u0627\u0644\u0634\u0627\u0631\u0629."],
  [/^(.+) removed you as a friend\.$/i, "\u0642\u0627\u0645 $1 \u0628\u0625\u0632\u0627\u0644\u062A\u0643 \u0645\u0646 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0635\u062F\u0642\u0627\u0621."],
  [/^A friend request from (.+) has been removed\.$/i, "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0637\u0644\u0628 \u0627\u0644\u0635\u062F\u0627\u0642\u0629 \u0645\u0646 $1."],
  [/^You were removed from the server (.+)\.$/i, "\u062A\u0645\u062A \u0625\u0632\u0627\u0644\u062A\u0643 \u0645\u0646 \u0633\u064A\u0631\u0641\u0631 $1."],
  [/^You were removed from the group (.+)\.$/i, "\u062A\u0645\u062A \u0625\u0632\u0627\u0644\u062A\u0643 \u0645\u0646 \u0645\u062C\u0645\u0648\u0639\u0629 $1."]
];
var DYNAMIC_PLURAL_PATTERNS = [
  { re: /^([\d,]+)\s+Server Boosts?$/i, single: "\u062A\u0639\u0632\u064A\u0632 \u0648\u0627\u062D\u062F \u0644\u0644\u0633\u064A\u0631\u0641\u0631", dual: "\u062A\u0639\u0632\u064A\u0632\u0627\u0646 \u0644\u0644\u0633\u064A\u0631\u0641\u0631", few: "\u062A\u0639\u0632\u064A\u0632\u0627\u062A \u0644\u0644\u0633\u064A\u0631\u0641\u0631", many: "\u062A\u0639\u0632\u064A\u0632\u064B\u0627 \u0644\u0644\u0633\u064A\u0631\u0641\u0631" },
  { re: /^([\d,]+)\s+Boosts?$/i, single: "\u062A\u0639\u0632\u064A\u0632 \u0648\u0627\u062D\u062F", dual: "\u062A\u0639\u0632\u064A\u0632\u0627\u0646", few: "\u062A\u0639\u0632\u064A\u0632\u0627\u062A", many: "\u062A\u0639\u0632\u064A\u0632\u064B\u0627" },
  { re: /^([\d,]+)\s+Mutual Servers?$/i, single: "\u0633\u064A\u0631\u0641\u0631 \u0645\u0634\u062A\u0631\u0643 \u0648\u0627\u062D\u062F", dual: "\u0633\u064A\u0631\u0641\u0631\u0627\u0646 \u0645\u0634\u062A\u0631\u0643\u0627\u0646", few: "\u0633\u064A\u0631\u0641\u0631\u0627\u062A \u0645\u0634\u062A\u0631\u0643\u0629", many: "\u0633\u064A\u0631\u0641\u0631\u064B\u0627 \u0645\u0634\u062A\u0631\u0643\u064B\u0627" },
  { re: /^([\d,]+)\s+Mutual Friends?$/i, single: "\u0635\u062F\u064A\u0642 \u0645\u0634\u062A\u0631\u0643 \u0648\u0627\u062D\u062F", dual: "\u0635\u062F\u064A\u0642\u0627\u0646 \u0645\u0634\u062A\u0631\u0643\u0627\u0646", few: "\u0623\u0635\u062F\u0642\u0627\u0621 \u0645\u0634\u062A\u0631\u0643\u0648\u0646", many: "\u0635\u062F\u064A\u0642\u064B\u0627 \u0645\u0634\u062A\u0631\u0643\u064B\u0627" },
  { re: /^([\d,]+)\s+Members?$/i, single: "\u0639\u0636\u0648 \u0648\u0627\u062D\u062F", dual: "\u0639\u0636\u0648\u0627\u0646", few: "\u0623\u0639\u0636\u0627\u0621", many: "\u0639\u0636\u0648\u064B\u0627" },
  { re: /^([\d,]+)\s+repl(?:y|ies)$/i, single: "\u0631\u062F \u0648\u0627\u062D\u062F", dual: "\u0631\u062F\u0651\u0627\u0646", few: "\u0631\u062F\u0648\u062F", many: "\u0631\u062F\u064B\u0627" },
  { re: /^([\d,]+)\s+reactions?$/i, single: "\u062A\u0641\u0627\u0639\u0644 \u0648\u0627\u062D\u062F", dual: "\u062A\u0641\u0627\u0639\u0644\u0627\u0646", few: "\u062A\u0641\u0627\u0639\u0644\u0627\u062A", many: "\u062A\u0641\u0627\u0639\u0644\u064B\u0627" },
  { re: /^([\d,]+)\s+Votes?$/i, single: "\u0635\u0648\u062A \u0648\u0627\u062D\u062F", dual: "\u0635\u0648\u062A\u0627\u0646", few: "\u0623\u0635\u0648\u0627\u062A", many: "\u0635\u0648\u062A\u064B\u0627" },
  { re: /^([\d,]+)\s+new messages?$/i, single: "\u0631\u0633\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629", dual: "\u0631\u0633\u0627\u0644\u062A\u0627\u0646 \u062C\u062F\u064A\u062F\u062A\u0627\u0646", few: "\u0631\u0633\u0627\u0626\u0644 \u062C\u062F\u064A\u062F\u0629", many: "\u0631\u0633\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629" },
  { re: /^([\d,]+)\s+unread messages?$/i, single: "\u0631\u0633\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u0642\u0631\u0648\u0621\u0629", dual: "\u0631\u0633\u0627\u0644\u062A\u0627\u0646 \u063A\u064A\u0631 \u0645\u0642\u0631\u0648\u0621\u062A\u064A\u0646", few: "\u0631\u0633\u0627\u0626\u0644 \u063A\u064A\u0631 \u0645\u0642\u0631\u0648\u0621\u0629", many: "\u0631\u0633\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u0642\u0631\u0648\u0621\u0629" },
  { re: /^([\d,]+)\s+games?\s+played$/i, single: "\u0644\u0639\u0628\u0629 \u0648\u0627\u062D\u062F\u0629 \u0645\u064F\u0644\u0639\u064E\u0628\u0629", dual: "\u0644\u0639\u0628\u062A\u0627\u0646 \u0645\u064F\u0644\u0639\u064E\u0628\u062A\u0627\u0646", few: "\u0623\u0644\u0639\u0627\u0628 \u0645\u064F\u0644\u0639\u064E\u0628\u0629", many: "\u0644\u0639\u0628\u0629 \u0645\u064F\u0644\u0639\u064E\u0628\u0629" },
  { re: /^([\d,]+)\s+hours?\s+of\s+games?\s+played$/i, single: "\u0633\u0627\u0639\u0629 \u0644\u0639\u0628 \u0648\u0627\u062D\u062F\u0629", dual: "\u0633\u0627\u0639\u062A\u0627 \u0644\u0639\u0628", few: "\u0633\u0627\u0639\u0627\u062A \u0644\u0639\u0628", many: "\u0633\u0627\u0639\u0629 \u0644\u0639\u0628" },
  { re: /^([\d,]+)\s+hours?\s+streamed\s+to\s+others$/i, single: "\u0633\u0627\u0639\u0629 \u0628\u062B \u0648\u0627\u062D\u062F\u0629 \u0644\u0644\u0622\u062E\u0631\u064A\u0646", dual: "\u0633\u0627\u0639\u062A\u0627 \u0628\u062B \u0644\u0644\u0622\u062E\u0631\u064A\u0646", few: "\u0633\u0627\u0639\u0627\u062A \u0628\u062B \u0644\u0644\u0622\u062E\u0631\u064A\u0646", many: "\u0633\u0627\u0639\u0629 \u0628\u062B \u0644\u0644\u0622\u062E\u0631\u064A\u0646" },
  { re: /^([\d,]+)\s+hours?\s+streamed$/i, single: "\u0633\u0627\u0639\u0629 \u0628\u062B \u0648\u0627\u062D\u062F\u0629", dual: "\u0633\u0627\u0639\u062A\u0627 \u0628\u062B", few: "\u0633\u0627\u0639\u0627\u062A \u0628\u062B", many: "\u0633\u0627\u0639\u0629 \u0628\u062B" },
  { re: /^([\d,]+)\s+Quests?\s+completed$/i, single: "\u0645\u0647\u0645\u0629 \u0648\u0627\u062D\u062F\u0629 \u0645\u0643\u062A\u0645\u0644\u0629", dual: "\u0645\u0647\u0645\u062A\u0627\u0646 \u0645\u0643\u062A\u0645\u0644\u062A\u0627\u0646", few: "\u0645\u0647\u0627\u0645 \u0645\u0643\u062A\u0645\u0644\u0629", many: "\u0645\u0647\u0645\u0629 \u0645\u0643\u062A\u0645\u0644\u0629" },
  { re: /^([\d,]+)(\+)?\s+gifts?$/i, supportsPlus: true, single: "\u0647\u062F\u064A\u0629 \u0648\u0627\u062D\u062F\u0629", dual: "\u0647\u062F\u064A\u062A\u0627\u0646", few: "\u0647\u062F\u0627\u064A\u0627", many: "\u0647\u062F\u064A\u0629" },
  { re: /^([\d,]+)(\+)?\s+months?$/i, supportsPlus: true, single: "\u0634\u0647\u0631 \u0648\u0627\u062D\u062F", dual: "\u0634\u0647\u0631\u0627\u0646", few: "\u0623\u0634\u0647\u0631", many: "\u0634\u0647\u0631\u064B\u0627" },
  { re: /^([\d,]+)(\+)?\s+years?$/i, supportsPlus: true, single: "\u0633\u0646\u0629 \u0648\u0627\u062D\u062F\u0629", dual: "\u0633\u0646\u062A\u0627\u0646", few: "\u0633\u0646\u0648\u0627\u062A", many: "\u0633\u0646\u0629" },
  { re: /^([\d,]+)(\+)?\s+weeks?$/i, supportsPlus: true, single: "\u0623\u0633\u0628\u0648\u0639 \u0648\u0627\u062D\u062F", dual: "\u0623\u0633\u0628\u0648\u0639\u0627\u0646", few: "\u0623\u0633\u0627\u0628\u064A\u0639", many: "\u0623\u0633\u0628\u0648\u0639\u064B\u0627" },
  { re: /^([\d,]+)(\+)?\s+days?$/i, supportsPlus: true, single: "\u064A\u0648\u0645 \u0648\u0627\u062D\u062F", dual: "\u064A\u0648\u0645\u0627\u0646", few: "\u0623\u064A\u0627\u0645", many: "\u064A\u0648\u0645\u064B\u0627" },
  { re: /^([\d,]+)(\+)?\s+hours?$/i, supportsPlus: true, single: "\u0633\u0627\u0639\u0629 \u0648\u0627\u062D\u062F\u0629", dual: "\u0633\u0627\u0639\u062A\u0627\u0646", few: "\u0633\u0627\u0639\u0627\u062A", many: "\u0633\u0627\u0639\u0629" },
  { re: /^([\d,]+)(\+)?\s+minutes?$/i, supportsPlus: true, single: "\u062F\u0642\u064A\u0642\u0629 \u0648\u0627\u062D\u062F\u0629", dual: "\u062F\u0642\u064A\u0642\u062A\u0627\u0646", few: "\u062F\u0642\u0627\u0626\u0642", many: "\u062F\u0642\u064A\u0642\u0629" },
  { re: /^([\d,]+)\s+others?$/i, single: "\u0634\u062E\u0635 \u0622\u062E\u0631", dual: "\u0634\u062E\u0635\u0627\u0646 \u0622\u062E\u0631\u0627\u0646", few: "\u0623\u0634\u062E\u0627\u0635 \u0622\u062E\u0631\u0648\u0646", many: "\u0634\u062E\u0635\u064B\u0627 \u0622\u062E\u0631" },
  { re: /^(\d+) years? ago$/i, prefix: "\u0645\u0646\u0630 ", single: "\u0633\u0646\u0629", dual: "\u0633\u0646\u062A\u064A\u0646", few: "\u0633\u0646\u0648\u0627\u062A", many: "\u0633\u0646\u0629" },
  { re: /^(\d+) months? ago$/i, prefix: "\u0645\u0646\u0630 ", single: "\u0634\u0647\u0631", dual: "\u0634\u0647\u0631\u064A\u0646", few: "\u0623\u0634\u0647\u0631", many: "\u0634\u0647\u0631\u064B\u0627" },
  { re: /^(\d+) days? ago$/i, prefix: "\u0645\u0646\u0630 ", single: "\u064A\u0648\u0645", dual: "\u064A\u0648\u0645\u064A\u0646", few: "\u0623\u064A\u0627\u0645", many: "\u064A\u0648\u0645\u064B\u0627" },
  { re: /^(\d+) hours? ago$/i, prefix: "\u0645\u0646\u0630 ", single: "\u0633\u0627\u0639\u0629", dual: "\u0633\u0627\u0639\u062A\u064A\u0646", few: "\u0633\u0627\u0639\u0627\u062A", many: "\u0633\u0627\u0639\u0629" },
  { re: /^(\d+) minutes? ago$/i, prefix: "\u0645\u0646\u0630 ", single: "\u062F\u0642\u064A\u0642\u0629", dual: "\u062F\u0642\u064A\u0642\u062A\u064A\u0646", few: "\u062F\u0642\u0627\u0626\u0642", many: "\u062F\u0642\u064A\u0642\u0629" },
  { re: /^([\d,]+)\s+Orbs$/i, single: "\u0643\u0631\u0629 \u0648\u0627\u062D\u062F\u0629", dual: "\u0643\u0631\u062A\u0627\u0646", few: "\u0643\u0631\u0627\u062A", many: "\u0643\u0631\u0629" }
];
var YEARS_MONTHS_RE = /^([\d,]+)\s+years?,\s*([\d,]+)\s+months?$/i;
var YEARS_DAYS_RE = /^([\d,]+)\s+years?,\s*([\d,]+)\s+days?$/i;
var MONTHS_DAYS_RE = /^([\d,]+)\s+months?,\s*([\d,]+)\s+days?$/i;
var HOURS_STREAMED_TO_N_OTHERS_RE = /^([\d,]+)\s+hours?\s+streamed\s+to\s+([\d,]+)\s+others?$/i;
var STREAMED_TO_N_OTHERS_RE = /^hours?\s+streamed\s+to\s+([\d,]+)\s+others?$/i;
function formatDynamicCompound(norm) {
  let m = YEARS_MONTHS_RE.exec(norm);
  if (m) {
    const y = formatArabicUnit(Number(m[1].replace(/,/g, "")), "\u0633\u0646\u0629 \u0648\u0627\u062D\u062F\u0629", "\u0633\u0646\u062A\u0627\u0646", "\u0633\u0646\u0648\u0627\u062A", "\u0633\u0646\u0629", m[1]);
    const mo = formatArabicUnit(Number(m[2].replace(/,/g, "")), "\u0634\u0647\u0631 \u0648\u0627\u062D\u062F", "\u0634\u0647\u0631\u0627\u0646", "\u0623\u0634\u0647\u0631", "\u0634\u0647\u0631\u064B\u0627", m[2]);
    return `${y} \u0648${mo}`;
  }
  m = YEARS_DAYS_RE.exec(norm);
  if (m) {
    const y = formatArabicUnit(Number(m[1].replace(/,/g, "")), "\u0633\u0646\u0629 \u0648\u0627\u062D\u062F\u0629", "\u0633\u0646\u062A\u0627\u0646", "\u0633\u0646\u0648\u0627\u062A", "\u0633\u0646\u0629", m[1]);
    const d = formatArabicUnit(Number(m[2].replace(/,/g, "")), "\u064A\u0648\u0645 \u0648\u0627\u062D\u062F", "\u064A\u0648\u0645\u0627\u0646", "\u0623\u064A\u0627\u0645", "\u064A\u0648\u0645\u064B\u0627", m[2]);
    return `${y} \u0648${d}`;
  }
  m = MONTHS_DAYS_RE.exec(norm);
  if (m) {
    const mo = formatArabicUnit(Number(m[1].replace(/,/g, "")), "\u0634\u0647\u0631 \u0648\u0627\u062D\u062F", "\u0634\u0647\u0631\u0627\u0646", "\u0623\u0634\u0647\u0631", "\u0634\u0647\u0631\u064B\u0627", m[1]);
    const d = formatArabicUnit(Number(m[2].replace(/,/g, "")), "\u064A\u0648\u0645 \u0648\u0627\u062D\u062F", "\u064A\u0648\u0645\u0627\u0646", "\u0623\u064A\u0627\u0645", "\u064A\u0648\u0645\u064B\u0627", m[2]);
    return `${mo} \u0648${d}`;
  }
  m = HOURS_STREAMED_TO_N_OTHERS_RE.exec(norm);
  if (m) {
    const h = formatArabicUnit(Number(m[1].replace(/,/g, "")), "\u0633\u0627\u0639\u0629 \u0628\u062B \u0648\u0627\u062D\u062F\u0629", "\u0633\u0627\u0639\u062A\u0627 \u0628\u062B", "\u0633\u0627\u0639\u0627\u062A \u0628\u062B", "\u0633\u0627\u0639\u0629 \u0628\u062B", m[1]);
    const o = formatArabicUnit(Number(m[2].replace(/,/g, "")), "\u0634\u062E\u0635 \u0622\u062E\u0631", "\u0634\u062E\u0635\u064A\u0646 \u0622\u062E\u0631\u064A\u0646", "\u0623\u0634\u062E\u0627\u0635 \u0622\u062E\u0631\u064A\u0646", "\u0634\u062E\u0635\u064B\u0627 \u0622\u062E\u0631", m[2]);
    return `${h} \u0644\u0640 ${o}`;
  }
  m = STREAMED_TO_N_OTHERS_RE.exec(norm);
  if (m) {
    const o = formatArabicUnit(Number(m[1].replace(/,/g, "")), "\u0634\u062E\u0635 \u0622\u062E\u0631", "\u0634\u062E\u0635\u064A\u0646 \u0622\u062E\u0631\u064A\u0646", "\u0623\u0634\u062E\u0627\u0635 \u0622\u062E\u0631\u064A\u0646", "\u0634\u062E\u0635\u064B\u0627 \u0622\u062E\u0631", m[1]);
    return `\u0633\u0627\u0639\u0627\u062A \u0628\u062B \u0644\u0640 ${o}`;
  }
  return void 0;
}
var DYNAMIC_TEXT_PATTERNS = [
  [
    /^Plans start at only (.+)\/month\. Cancel anytime$/i,
    "\u0627\u0644\u062E\u0637\u0637 \u062A\u0628\u062F\u0623 \u0645\u0646 $1/\u0634\u0647\u0631\u064A\u0627\u064B \u0641\u0642\u0637. \u0627\u0644\u0625\u0644\u063A\u0627\u0621 \u0641\u064A \u0623\u064A \u0648\u0642\u062A"
  ],
  [/^Message (#.+)$/i, "\u0623\u0631\u0633\u0644 \u0631\u0633\u0627\u0644\u0629 \u0641\u064A $1"],
  [/^Message (@.+)$/i, "\u0623\u0631\u0633\u0644 \u0631\u0633\u0627\u0644\u0629 \u0625\u0644\u0649 $1"],
  [/^Search (.+)$/i, "\u0628\u062D\u062B \u0641\u064A $1"],
  [/^Edit Role — (.+)$/i, "\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062F\u0648\u0631 \u2014 $1"],
  [/^Invite friends to (.+)$/i, "\u062F\u0639\u0648\u0629 \u0623\u0635\u062F\u0642\u0627\u0621 \u0625\u0644\u0649 $1"],
  [/^Welcome to (.+)!$/i, "\u0623\u0647\u0644\u0627\u064B \u0628\u0643 \u0641\u064A $1!"],
  [/^This is the start of the (#.+) channel\.$/i, "\u0647\u0630\u0647 \u0628\u062F\u0627\u064A\u0629 \u0642\u0646\u0627\u0629 $1."],
  [/^Playing (.+)$/i, "\u064A\u0644\u0639\u0628 $1"],
  [/^Watching (.+)$/i, "\u064A\u0634\u0627\u0647\u062F $1"],
  [/^Listening to (.+)$/i, "\u064A\u0633\u062A\u0645\u0639 \u0625\u0644\u0649 $1"],
  [/^Streaming (.+)$/i, "\u064A\u0628\u062B $1"]
];
var EN_MONTH_TO_AR = {
  january: "\u064A\u0646\u0627\u064A\u0631",
  february: "\u0641\u0628\u0631\u0627\u064A\u0631",
  march: "\u0645\u0627\u0631\u0633",
  april: "\u0623\u0628\u0631\u064A\u0644",
  may: "\u0645\u0627\u064A\u0648",
  june: "\u064A\u0648\u0646\u064A\u0648",
  july: "\u064A\u0648\u0644\u064A\u0648",
  august: "\u0623\u063A\u0633\u0637\u0633",
  september: "\u0633\u0628\u062A\u0645\u0628\u0631",
  october: "\u0623\u0643\u062A\u0648\u0628\u0631",
  november: "\u0646\u0648\u0641\u0645\u0628\u0631",
  december: "\u062F\u064A\u0633\u0645\u0628\u0631"
};
var FULL_DATE_RE = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})$/i;
var CALENDAR_TIME_RE = /^(Today|Yesterday) at (\d{1,2}:\d{2})(?:\s*(AM|PM))?$/i;
function cacheLookupResult(key, result) {
  if (lookupCache.size >= LOOKUP_CACHE_LIMIT) {
    const oldestKey = lookupCache.keys().next().value;
    if (oldestKey !== void 0) {
      lookupCache.delete(oldestKey);
    }
  }
  lookupCache.set(key, result ?? null);
  return result;
}
function formatRegexReplacement(match, template) {
  return template.replace(/\$(\d+)/g, (_, idx) => match[Number(idx)] ?? "");
}
function lookupString(raw, lookups) {
  if (!HAS_LATIN_RE.test(raw)) return void 0;
  const direct = lookups.byTextMap.get(raw);
  if (direct) return direct;
  const cached = lookupCache.get(raw);
  if (cached !== void 0) {
    lookupCache.delete(raw);
    lookupCache.set(raw, cached);
    return cached ?? void 0;
  }
  const norm = normalizeText(raw);
  if (norm !== raw) {
    const exactNorm = lookups.byTextMap.get(norm);
    if (exactNorm) return cacheLookupResult(raw, exactNorm);
  }
  if (HAS_DIGIT_RE.test(norm)) {
    const calMatch = CALENDAR_TIME_RE.exec(norm);
    if (calMatch) {
      const dayWord = calMatch[1].toLowerCase() === "today" ? "\u0627\u0644\u064A\u0648\u0645" : "\u0623\u0645\u0633";
      const meridiem = calMatch[3] ? calMatch[3].toUpperCase() === "AM" ? " \u0635" : " \u0645" : "";
      return cacheLookupResult(raw, `${dayWord} \u0627\u0644\u0633\u0627\u0639\u0629 ${calMatch[2]}${meridiem}`);
    }
    const dateMatch = FULL_DATE_RE.exec(norm);
    if (dateMatch) {
      const arMonth = EN_MONTH_TO_AR[dateMatch[1].toLowerCase()];
      if (arMonth) {
        return cacheLookupResult(raw, `${dateMatch[2]} ${arMonth} ${dateMatch[3]}`);
      }
    }
    if (norm.length >= 4) {
      const normHit = getNormLookupMap(lookups).get(norm.toLowerCase());
      if (normHit) return cacheLookupResult(raw, normHit);
    }
    for (const [pattern, replacement] of DYNAMIC_NUMBER_PATTERNS) {
      const match = pattern.exec(norm);
      if (match) {
        return cacheLookupResult(raw, formatRegexReplacement(match, replacement));
      }
    }
    const compoundHit = formatDynamicCompound(norm);
    if (compoundHit) return cacheLookupResult(raw, compoundHit);
    for (const entry of DYNAMIC_PLURAL_PATTERNS) {
      const match = entry.re.exec(norm);
      if (!match) continue;
      const rawNum = match[1];
      const hasPlus = Boolean(entry.supportsPlus && match[2] === "+");
      const parsed = Number(rawNum.replace(/,/g, ""));
      if (!Number.isFinite(parsed)) continue;
      if (hasPlus) {
        const mod100 = parsed % 100;
        const unit = mod100 >= 3 && mod100 <= 10 ? entry.few : entry.many;
        return cacheLookupResult(raw, `${entry.prefix ?? ""}\u2066${rawNum}+\u2069 ${unit}`);
      }
      const formatted = formatArabicUnit(
        parsed,
        entry.single,
        entry.dual,
        entry.few,
        entry.many,
        rawNum
      );
      return cacheLookupResult(raw, `${entry.prefix ?? ""}${formatted}`);
    }
  } else if (norm.length >= 4) {
    const normHit = getNormLookupMap(lookups).get(norm.toLowerCase());
    if (normHit) return cacheLookupResult(raw, normHit);
  }
  if (norm.includes(" ")) {
    for (const [pattern, replacement] of DYNAMIC_TEXT_PATTERNS) {
      const match = pattern.exec(norm);
      if (match) {
        return cacheLookupResult(raw, formatRegexReplacement(match, replacement));
      }
    }
  }
  return cacheLookupResult(raw, void 0);
}
function recordUntranslated(value) {
  if (true) return;
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 180) return;
  if (!/[A-Za-z]{2,}/.test(trimmed)) return;
  if (/[\u0600-\u06FF]/.test(trimmed)) return;
  if (/^(https?:\/\/|@|#|\d+[:/.,-]\d+)/i.test(trimmed)) return;
  if (/^(Today|Yesterday) at \d/i.test(trimmed) || FULL_DATE_RE.test(trimmed)) return;
  seenUntranslated.add(trimmed);
}
function translateOutput(out, lookups) {
  if (typeof out === "string") {
    const hit = lookupString(out, lookups);
    if (hit) {
      const trimmed = out.trim();
      return trimmed !== out ? out.replace(trimmed, hit) : hit;
    }
    recordUntranslated(out);
    return out;
  }
  if (Array.isArray(out)) {
    let changed = false;
    const mapped = out.map((item) => {
      if (typeof item === "string") {
        const hit = lookupString(item, lookups);
        if (hit) {
          changed = true;
          return hit;
        }
        recordUntranslated(item);
      }
      return item;
    });
    return changed ? mapped : out;
  }
  return out;
}
function patchIntlObject(target) {
  if (!target || patchedTargets.some((p) => p.target === target)) return;
  const originals = {};
  const methods = ["string", "format", "formatToPlainString", "formatToMarkdownString"];
  for (const methodName of methods) {
    if (!Object.hasOwn(target, methodName) || typeof target[methodName] !== "function")
      continue;
    const orig = target[methodName];
    originals[methodName] = orig;
    target[methodName] = function(...args) {
      const [msg, values] = args;
      if (active && msg && (typeof msg === "object" || typeof msg === "function")) {
        const direct = byAccessor.get(msg);
        if (direct) {
          if (methodName === "string") return direct;
          if (methodName === "format") return formatRichTemplate(direct, values);
          return formatPlainTemplate(direct, values);
        }
      }
      const out = orig.apply(this, args);
      return active ? translateOutput(out, cachedLookups ?? buildTranslationLookups()) : out;
    };
  }
  if (Object.keys(originals).length > 0) {
    patchedTargets.push({ target, originals });
  }
}
var SKIP_SUBTREE_SELECTORS = [
  "pre",
  "code",
  "script",
  "style",
  "[class*='messageContent_']",
  "[class*='markup_']",
  "[class*='repliedMessage_']",
  "[class*='embed_']",
  "[class*='username_']",
  "[class*='globalName_']",
  "[class*='nickname_']",
  "[class*='userTag_']",
  "[class*='channelName_']",
  "[class*='guildName_']",
  "[class*='acronym_']",
  "[class*='members_'] [class*='member_']",
  "[class*='privateChannels_'] [class*='channel_'] [class*='name_']",
  "[class*='userPopout'] [class*='subtext_']",
  "[class*='accountProfileCard'] [class*='subtext_']",
  "[class*='accountPopoutButtonWrapper_'] [class*='customStatus_']",
  "[class*='role_']"
];
var SKIP_SUBTREE_SELECTOR = SKIP_SUBTREE_SELECTORS.join(",");
var SKIP_EDITOR_SELECTOR = "[contenteditable='true'],[class*='slateTextArea_']";
var PLACEHOLDER_SELECTOR = "[class*='placeholder_'],.public-DraftEditorPlaceholder-inner";
var AUTO_DIR_SELECTOR = [
  "[class*='truncated_HigqCD']",
  "[class*='subtext_yc3axZ']",
  "[class*='activityStatusText_']",
  "[class*='subtext_zln_tS']",
  "[class*='gameName_UQqFnR']",
  "[class*='membersGroupName_']",
  "[class*='clipTitle_']"
].join(",");
function markAutoDirElement(el) {
  if (el.getAttribute("dir") !== "auto") {
    el.setAttribute("dir", "auto");
  }
  if (el.getAttribute("data-arabic-auto-dir") !== "1") {
    el.setAttribute("data-arabic-auto-dir", "1");
  }
}
function syncAutoDirInSubtree(node) {
  if (!settings.store.enableRtl) return;
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement?.closest(AUTO_DIR_SELECTOR);
    if (parent) markAutoDirElement(parent);
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node;
    if (el.matches(AUTO_DIR_SELECTOR)) {
      markAutoDirElement(el);
    } else {
      const ancestor = el.closest(AUTO_DIR_SELECTOR);
      if (ancestor) markAutoDirElement(ancestor);
    }
    if (el.firstElementChild !== null) {
      for (const match of el.querySelectorAll(AUTO_DIR_SELECTOR)) {
        markAutoDirElement(match);
      }
    }
  }
}
function clearAutoDirAttrs() {
  for (const el of document.querySelectorAll("[data-arabic-auto-dir='1']")) {
    if (el.getAttribute("dir") === "auto") {
      el.removeAttribute("dir");
    }
    el.removeAttribute("data-arabic-auto-dir");
  }
}
var SKIP_DOM_SELECTOR = [
  ...SKIP_SUBTREE_SELECTORS,
  "[contenteditable='true']",
  "[class*='slateTextArea_']"
].join(",");
function shouldSkipElement(el) {
  if (!el) return true;
  if (el.closest(SKIP_DOM_SELECTOR) && !el.closest(PLACEHOLDER_SELECTOR)) return true;
  return false;
}
function translateInputPlaceholder(el, lookups) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  const rawPh = el.placeholder;
  if (!rawPh || !HAS_LATIN_RE.test(rawPh) || translatedPlaceholders.get(el) === rawPh) return;
  if (shouldSkipElement(el)) return;
  const ph = rawPh.trim();
  if (ph) {
    const hit = lookupString(ph, lookups);
    if (hit && hit !== ph) {
      translatedPlaceholders.set(el, hit);
      el.placeholder = hit;
    }
  }
}
function applyTextNodeTranslation(textNode, lookups, fromPreFilteredWalker = false) {
  const raw = textNode.nodeValue;
  if (!raw || !HAS_LATIN_RE.test(raw) || translatedNodeValues.get(textNode) === raw) return;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 220) return;
  const parent = textNode.parentElement;
  if (!parent) return;
  if (fromPreFilteredWalker) {
    if (parent.closest(SKIP_EDITOR_SELECTOR) && !parent.closest(PLACEHOLDER_SELECTOR)) return;
  } else if (shouldSkipElement(parent)) {
    return;
  }
  const hit = lookupString(trimmed, lookups);
  if (hit && hit !== trimmed) {
    const nextValue = trimmed.length !== raw.length ? raw.replace(trimmed, hit) : hit;
    translatedNodeValues.set(textNode, nextValue);
    textNode.nodeValue = nextValue;
  }
}
function translateDomNode(node, lookups) {
  if (!active) return;
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node;
    if (!shouldSkipElement(textNode.parentElement)) {
      syncAutoDirInSubtree(textNode);
      applyTextNodeTranslation(textNode, lookups, true);
    }
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node;
    if (shouldSkipElement(el)) return;
    syncAutoDirInSubtree(el);
    translateInputPlaceholder(el, lookups);
    if (el.firstElementChild === null) {
      for (let child = el.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === Node.TEXT_NODE) {
          applyTextNodeTranslation(child, lookups, true);
        }
      }
      return;
    }
    for (const input of el.getElementsByTagName("input")) {
      translateInputPlaceholder(input, lookups);
    }
    for (const textarea of el.getElementsByTagName("textarea")) {
      translateInputPlaceholder(textarea, lookups);
    }
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode(n) {
          if (n.nodeType === Node.ELEMENT_NODE) {
            const elem = n;
            if (elem.matches(SKIP_SUBTREE_SELECTOR) && !elem.matches(PLACEHOLDER_SELECTOR)) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_SKIP;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    let current;
    while (current = walker.nextNode()) {
      applyTextNodeTranslation(current, lookups, true);
    }
  }
}
function startDomFallback() {
  if (domObserver || !document.body) return;
  translateDomNode(document.body, cachedLookups ?? buildTranslationLookups());
  const pendingNodes = /* @__PURE__ */ new Set();
  let rafId = null;
  const flush = () => {
    rafId = null;
    if (!active) {
      pendingNodes.clear();
      return;
    }
    if (pendingNodes.size > 1) {
      for (const node of pendingNodes) {
        if (!node.isConnected) {
          pendingNodes.delete(node);
          continue;
        }
        let p = node.parentNode;
        while (p) {
          if (pendingNodes.has(p)) {
            pendingNodes.delete(node);
            break;
          }
          p = p.parentNode;
        }
      }
    }
    for (const node of pendingNodes) {
      if (node.isConnected) {
        translateDomNode(node, cachedLookups ?? buildTranslationLookups());
      }
    }
    pendingNodes.clear();
  };
  domObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "characterData") {
        if (!shouldSkipElement(m.target.parentElement)) {
          pendingNodes.add(m.target);
        }
      } else if (m.type === "attributes") {
        if (m.target instanceof Element && !shouldSkipElement(m.target)) {
          pendingNodes.add(m.target);
        }
      } else if (m.type === "childList") {
        for (const added of m.addedNodes) {
          if (added.nodeType === Node.ELEMENT_NODE) {
            if (!shouldSkipElement(added)) {
              pendingNodes.add(added);
            }
          } else if (added.nodeType === Node.TEXT_NODE && !shouldSkipElement(added.parentElement)) {
            pendingNodes.add(added);
          }
        }
      }
    }
    if (pendingNodes.size > 0 && rafId === null) {
      rafId = requestAnimationFrame(flush);
    }
  });
  domObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["placeholder"]
  });
  stopDomFallbackFn = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pendingNodes.clear();
    if (domObserver) {
      domObserver.disconnect();
      domObserver = null;
    }
  };
}
var patchedLoader = null;
var clonedIntlMessages = /* @__PURE__ */ new WeakMap();
function applyLoadedDictionaries(arDict, complexDict, triggerRerender = true) {
  if (!active) return;
  activeDict = arDict;
  complexArMap = new Map(Object.entries(complexDict));
  cachedLookups = null;
  lookupCache.clear();
  clonedIntlMessages = /* @__PURE__ */ new WeakMap();
  translatedNodeValues = /* @__PURE__ */ new WeakMap();
  translatedPlaceholders = /* @__PURE__ */ new WeakMap();
  byAccessor = /* @__PURE__ */ new WeakMap();
  const lookups = buildTranslationLookups();
  if (triggerRerender) {
    if (document.body) {
      translateDomNode(document.body, lookups);
    }
    applyArabicDateSystem(true);
  }
}
async function refreshRemoteTranslations(manual) {
  if (!active || isCheckingRemoteUpdates) return false;
  const gen = lifecycleGeneration;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  isCheckingRemoteUpdates = true;
  activeFetchController = controller;
  try {
    const init = controller ? { cache: "no-cache", signal: controller.signal } : { cache: "no-cache" };
    const [arRes, complexRes] = await Promise.all([
      fetch(REMOTE_AR_URL, init),
      fetch(REMOTE_COMPLEX_URL, init)
    ]);
    if (!active || gen !== lifecycleGeneration) return false;
    if (!arRes.ok || !complexRes.ok) {
      throw new Error(`HTTP ${arRes.status}/${complexRes.status}`);
    }
    const [arJson, complexJson] = await Promise.all([
      arRes.json(),
      complexRes.json()
    ]);
    if (!active || gen !== lifecycleGeneration) return false;
    if (!isValidDictionaries(arJson, complexJson) || !arJson.byText) {
      throw new Error("Invalid or incomplete translation payload");
    }
    const arCount = Object.keys(arJson.byText).length;
    const complexCount = Object.keys(complexJson).length;
    const meta = { updatedAt: Date.now(), arCount, complexCount };
    const wrote = await persistDictionariesQueued(gen, [
      [DS_AR_KEY, arJson],
      [DS_COMPLEX_KEY, complexJson],
      [DS_META_KEY, meta]
    ]);
    if (!wrote || !active || gen !== lifecycleGeneration) return false;
    applyLoadedDictionaries(arJson, complexJson, true);
    logger.info(`Loaded remote Arabic dictionaries (${arCount} simple, ${complexCount} complex).`);
    if (manual && active && gen === lifecycleGeneration) {
      showToast({
        text: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0642\u0627\u0645\u0648\u0633 (${arCount.toLocaleString("en-US")} \u0646\u0635)`,
        variant: "success"
      });
    }
    return true;
  } catch (err) {
    if (!active || gen !== lifecycleGeneration || controller?.signal.aborted) {
      return false;
    }
    logger.warn("Failed to fetch remote Arabic translations:", err);
    if (manual) {
      showToast({
        text: "\u062A\u0639\u0630\u0651\u0631 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062A\u0631\u062C\u0645\u0627\u062A \u0645\u0646 GitHub",
        variant: "critical"
      });
    }
    return false;
  } finally {
    if (gen === lifecycleGeneration) {
      isCheckingRemoteUpdates = false;
      if (activeFetchController === controller) {
        activeFetchController = null;
      }
    }
  }
}
async function initDictionaries() {
  const gen = lifecycleGeneration;
  try {
    await storageWriteChain;
    if (!active || gen !== lifecycleGeneration) return;
    const [cachedAr, cachedComplex, meta] = await getMany([
      DS_AR_KEY,
      DS_COMPLEX_KEY,
      DS_META_KEY
    ]);
    if (!active || gen !== lifecycleGeneration) return;
    if (cachedAr && cachedComplex && isValidDictionaries(cachedAr, cachedComplex)) {
      applyLoadedDictionaries(cachedAr, cachedComplex, true);
      const isStale = !meta?.updatedAt || Date.now() - meta.updatedAt >= UPDATE_INTERVAL_MS;
      if (isStale) {
        void refreshRemoteTranslations(false);
      }
      return;
    }
  } catch (err) {
    logger.warn("Failed to read cached Arabic dictionaries from DataStore:", err);
  }
  if (active && gen === lifecycleGeneration) {
    await refreshRemoteTranslations(false);
  }
}
function patchLoaderPrototype(proto) {
  if (patchedLoader || !proto || typeof proto.get !== "function") return;
  const origGet = proto.get;
  patchedLoader = { proto, origGet };
  proto.get = function(hash2, locale) {
    const origMsg = origGet.call(this, hash2, locale);
    if (!active || !origMsg || origMsg === this.fallbackMessage) return origMsg;
    const cached = clonedIntlMessages.get(origMsg);
    if (cached) return cached;
    const arAst = complexArMap.get(hash2);
    if (arAst) {
      const clone = Object.create(Object.getPrototypeOf(origMsg));
      clone.locale = ARABIC_DATE_LOCALE;
      clone.ast = arAst;
      clonedIntlMessages.set(origMsg, clone);
      return clone;
    }
    if (Array.isArray(origMsg.ast) && origMsg.ast.length === 1 && typeof origMsg.ast[0] === "string") {
      const hit = lookupString(origMsg.ast[0], cachedLookups ?? buildTranslationLookups());
      if (hit) {
        const clone = Object.create(Object.getPrototypeOf(origMsg));
        clone.locale = ARABIC_DATE_LOCALE;
        clone.ast = [hit];
        clonedIntlMessages.set(origMsg, clone);
        return clone;
      }
    }
    return origMsg;
  };
}
function patchMessageLoader() {
  if (patchedLoader) return;
  try {
    const loader = i18n?.t?.$$loader;
    if (!loader) return;
    patchLoaderPrototype(Object.getPrototypeOf(loader));
  } catch {
  }
}
var index_default = definePlugin({
  name: "ArabicDiscord",
  description: "Full Arabic localization for Discord with Arabic fonts and RTL layout support",
  authors: [{ name: "7madh", id: 0n }],
  tags: ["Appearance", "Customisation", "Utility"],
  settings,
  startAt: StartAt.Init,
  toolboxActions() {
    const { enableRtl } = settings.use(["enableRtl"]);
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
      Menu.MenuCheckboxItem,
      {
        id: "arabic-discord-rtl-toggle",
        label: "Full RTL Layout",
        checked: Boolean(enableRtl),
        action: () => {
          settings.store.enableRtl = !enableRtl;
          applyStylesFromSettings();
        }
      }
    ), /* @__PURE__ */ React.createElement(
      Menu.MenuItem,
      {
        id: "arabic-discord-update-translations",
        label: "Update Arabic Translations",
        action: () => {
          void refreshRemoteTranslations(true);
        }
      }
    ), false);
  },
  start() {
    lifecycleGeneration++;
    isCheckingRemoteUpdates = false;
    activeFetchController?.abort();
    activeFetchController = null;
    active = true;
    enableStyle(styles_default);
    void initDictionaries();
    const initDom = () => {
      if (!active) return;
      applyStylesFromSettings();
      startRootAttrGuard();
      startDomFallback();
      applyArabicDateSystem();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initDom, { once: true });
    } else {
      initDom();
    }
    waitFor("parseTwoDigitYear", () => {
      if (!active) return;
      applyArabicDateSystem();
    });
    waitFor(
      (m) => typeof m?.getDiscordUtils === "function",
      () => {
        if (!active) return;
        applyArabicDateSystem();
      }
    );
    waitFor(
      (m) => m?.getName?.() === "LocaleStore",
      () => {
        if (!active) return;
        applyArabicDateSystem(true);
      }
    );
    waitFor(["dispatch", "subscribe"], (flux) => {
      if (!active || !flux?.subscribe) return;
      flux.subscribe("CONNECTION_OPEN", onDiscordLocaleFlux);
      flux.subscribe("CACHE_LOADED", onDiscordLocaleFlux);
      flux.subscribe("USER_SETTINGS_PROTO_UPDATE", onDiscordLocaleFlux);
      flux.subscribe("USER_SETTINGS_LOCALE_OVERRIDE", onDiscordLocaleFlux);
      onDiscordLocaleFlux();
      if (dateSyncTimeoutId === null) {
        dateSyncTimeoutId = window.setTimeout(() => {
          dateSyncTimeoutId = null;
          if (active) {
            applyArabicDateSystem(true);
          }
        }, 2e3);
      }
    });
    waitFor("MessageLoader", (mod) => {
      if (!active) return;
      patchLoaderPrototype(mod?.MessageLoader?.prototype);
    });
    waitFor(
      (m) => m != null && Object.getPrototypeOf(m)?.withFormatters != null,
      (intlObj) => {
        if (!active) return;
        patchIntlObject(intlObj);
        const proto = Object.getPrototypeOf(intlObj);
        if (proto) patchIntlObject(proto);
        patchMessageLoader();
        queueMicrotask(() => {
          if (!active) return;
          populateKeyAccessors();
          patchMessageLoader();
          applyArabicDateSystem();
        });
        logger.info("\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u062A\u0639\u0631\u064A\u0628 \u062F\u064A\u0633\u0643\u0648\u0631\u062F \u0628\u0646\u062C\u0627\u062D!");
      }
    );
  },
  stop() {
    lifecycleGeneration++;
    isCheckingRemoteUpdates = false;
    activeFetchController?.abort();
    activeFetchController = null;
    active = false;
    activeDict = {};
    complexArMap.clear();
    cachedLookups = null;
    lookupCache.clear();
    clonedIntlMessages = /* @__PURE__ */ new WeakMap();
    translatedNodeValues = /* @__PURE__ */ new WeakMap();
    translatedPlaceholders = /* @__PURE__ */ new WeakMap();
    byAccessor = /* @__PURE__ */ new WeakMap();
    disableStyle(styles_default);
    if (dateSyncTimeoutId !== null) {
      clearTimeout(dateSyncTimeoutId);
      dateSyncTimeoutId = null;
    }
    try {
      FluxDispatcher?.unsubscribe?.("CONNECTION_OPEN", onDiscordLocaleFlux);
      FluxDispatcher?.unsubscribe?.("CACHE_LOADED", onDiscordLocaleFlux);
      FluxDispatcher?.unsubscribe?.("USER_SETTINGS_PROTO_UPDATE", onDiscordLocaleFlux);
      FluxDispatcher?.unsubscribe?.("USER_SETTINGS_LOCALE_OVERRIDE", onDiscordLocaleFlux);
    } catch {
    }
    if (rootAttrObserver) {
      rootAttrObserver.disconnect();
      rootAttrObserver = null;
    }
    clearStyles();
    applyArabicDateSystem();
    restoreNativeDateFormatter();
    prevMomentLocale = null;
    prevIntlLocale = null;
    if (stopDomFallbackFn) {
      stopDomFallbackFn();
      stopDomFallbackFn = null;
    } else if (domObserver) {
      domObserver.disconnect();
      domObserver = null;
    }
    if (patchedLoader) {
      patchedLoader.proto.get = patchedLoader.origGet;
      patchedLoader = null;
    }
    while (patchedTargets.length > 0) {
      const entry = patchedTargets.pop();
      for (const [name, orig] of Object.entries(entry.originals)) {
        if (orig) entry.target[name] = orig;
      }
    }
    logger.info("\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u062A\u0639\u0631\u064A\u0628 \u062F\u064A\u0633\u0643\u0648\u0631\u062F.");
  }
});

// src/userplugins/arabicDiscord/betterdiscord/entry.mjs
function findToolboxAction(node, id) {
  if (!node || typeof node !== "object") return null;
  if (node.props?.id === id && typeof node.props.action === "function") {
    return node.props.action;
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const hit = findToolboxAction(child, id);
      if (hit) return hit;
    }
  }
  return null;
}
function createSettingRow(titleText, descText, controlEl) {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.justifyContent = "space-between";
  row.style.gap = "16px";
  row.style.padding = "14px 16px";
  row.style.borderRadius = "8px";
  row.style.background = "var(--background-secondary, rgba(255, 255, 255, 0.04))";
  row.style.border = "1px solid var(--background-modifier-accent, rgba(255, 255, 255, 0.08))";
  const info = document.createElement("div");
  info.style.display = "flex";
  info.style.flexDirection = "column";
  info.style.gap = "4px";
  info.style.flex = "1";
  const title = document.createElement("div");
  title.textContent = titleText;
  title.style.fontSize = "15px";
  title.style.fontWeight = "600";
  title.style.color = "var(--header-primary, #f2f3f5)";
  const desc = document.createElement("div");
  desc.textContent = descText;
  desc.style.fontSize = "13px";
  desc.style.color = "var(--text-muted, #b5bac1)";
  info.appendChild(title);
  info.appendChild(desc);
  row.appendChild(info);
  row.appendChild(controlEl);
  return row;
}
var ArabicDiscord = class {
  start() {
    resetBdWaitControllers();
    index_default.start();
  }
  stop() {
    abortBdWaitControllers();
    index_default.stop();
  }
  getSettingsPanel() {
    const settingsObj = activeSettingsObject;
    const container = document.createElement("div");
    container.dir = "rtl";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "12px";
    container.style.padding = "8px 0";
    if (!settingsObj) {
      return container;
    }
    const banner = document.createElement("div");
    banner.style.display = "flex";
    banner.style.alignItems = "center";
    banner.style.justifyContent = "space-between";
    banner.style.padding = "14px 18px";
    banner.style.borderRadius = "10px";
    banner.style.background = "linear-gradient(135deg, rgba(88, 101, 242, 0.22), rgba(114, 137, 218, 0.08))";
    banner.style.border = "1px solid rgba(88, 101, 242, 0.4)";
    const brandTitle = document.createElement("div");
    brandTitle.textContent = "ArabicDiscord v0.1.0";
    brandTitle.style.fontSize = "16px";
    brandTitle.style.fontWeight = "700";
    brandTitle.style.color = "var(--header-primary, #f2f3f5)";
    const brandAuthor = document.createElement("span");
    brandAuthor.textContent = "by 7madh";
    brandAuthor.style.fontSize = "13px";
    brandAuthor.style.fontWeight = "600";
    brandAuthor.style.padding = "4px 10px";
    brandAuthor.style.borderRadius = "999px";
    brandAuthor.style.background = "rgba(88, 101, 242, 0.28)";
    brandAuthor.style.color = "#dfe3ff";
    banner.appendChild(brandTitle);
    banner.appendChild(brandAuthor);
    container.appendChild(banner);
    const { def, store } = settingsObj;
    const fontSelect = document.createElement("select");
    fontSelect.setAttribute("data-setting", "arabicFont");
    fontSelect.style.minWidth = "220px";
    fontSelect.style.padding = "8px 10px";
    fontSelect.style.borderRadius = "6px";
    fontSelect.style.border = "1px solid var(--background-modifier-accent, rgba(255,255,255,0.16))";
    fontSelect.style.background = "var(--input-background, #1e1f22)";
    fontSelect.style.color = "var(--text-normal, #dbdee1)";
    fontSelect.style.fontSize = "14px";
    fontSelect.style.cursor = "pointer";
    for (const opt of def.arabicFont.options) {
      const optionEl = document.createElement("option");
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      if (opt.value === store.arabicFont) {
        optionEl.selected = true;
      }
      fontSelect.appendChild(optionEl);
    }
    fontSelect.value = store.arabicFont;
    fontSelect.addEventListener("change", () => {
      store.arabicFont = fontSelect.value;
      def.arabicFont?.onChange?.(fontSelect.value);
    });
    container.appendChild(
      createSettingRow(
        "\u0627\u0644\u062E\u0637 \u0627\u0644\u0639\u0631\u0628\u064A (Arabic Font)",
        "\u0627\u062E\u062A\u0631 \u0645\u0646 \u0628\u064A\u0646 \u0627\u0644\u062E\u0637\u0648\u0637 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0645\u062F\u0645\u062C\u0629 \u0623\u0648 \u062E\u0637 \u0627\u0644\u0646\u0638\u0627\u0645 \u0644\u0644\u0648\u0627\u062C\u0647\u0629 \u0648\u0627\u0644\u0646\u0635\u0648\u0635.",
        fontSelect
      )
    );
    const scaleWrap = document.createElement("div");
    scaleWrap.style.display = "flex";
    scaleWrap.style.alignItems = "center";
    scaleWrap.style.gap = "10px";
    const scaleSlider = document.createElement("input");
    scaleSlider.type = "range";
    scaleSlider.setAttribute("data-setting", "fontScale");
    scaleSlider.min = "90";
    scaleSlider.max = "120";
    scaleSlider.step = "5";
    scaleSlider.value = String(Number(store.fontScale) || 100);
    scaleSlider.style.width = "160px";
    scaleSlider.style.cursor = "pointer";
    const scaleValueLabel = document.createElement("span");
    scaleValueLabel.textContent = `${scaleSlider.value}%`;
    scaleValueLabel.style.minWidth = "44px";
    scaleValueLabel.style.textAlign = "center";
    scaleValueLabel.style.fontWeight = "600";
    scaleValueLabel.style.fontSize = "14px";
    scaleValueLabel.style.color = "var(--header-primary, #f2f3f5)";
    scaleSlider.addEventListener("input", () => {
      const num = Number(scaleSlider.value) || 100;
      scaleValueLabel.textContent = `${num}%`;
      store.fontScale = num;
      def.fontScale?.onChange?.(num);
    });
    scaleSlider.addEventListener("change", () => {
      const num = Number(scaleSlider.value) || 100;
      scaleValueLabel.textContent = `${num}%`;
      store.fontScale = num;
      def.fontScale?.onChange?.(num);
    });
    scaleWrap.appendChild(scaleSlider);
    scaleWrap.appendChild(scaleValueLabel);
    container.appendChild(
      createSettingRow(
        "\u062D\u062C\u0645 \u0627\u0644\u062E\u0637 \u0627\u0644\u0639\u0631\u0628\u064A (Font Size)",
        "\u062A\u062D\u0643\u0651\u0645 \u0641\u064A \u0646\u0633\u0628\u0629 \u062A\u0643\u0628\u064A\u0631 \u0623\u0648 \u062A\u0635\u063A\u064A\u0631 \u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0645\u0646 90% \u0625\u0644\u0649 120%.",
        scaleWrap
      )
    );
    const rtlCheckbox = document.createElement("input");
    rtlCheckbox.type = "checkbox";
    rtlCheckbox.setAttribute("data-setting", "enableRtl");
    rtlCheckbox.checked = Boolean(store.enableRtl);
    rtlCheckbox.style.width = "22px";
    rtlCheckbox.style.height = "22px";
    rtlCheckbox.style.cursor = "pointer";
    rtlCheckbox.style.accentColor = "var(--brand-500, #5865f2)";
    rtlCheckbox.addEventListener("change", () => {
      const nextVal = Boolean(rtlCheckbox.checked);
      store.enableRtl = nextVal;
      def.enableRtl?.onChange?.(nextVal);
    });
    container.appendChild(
      createSettingRow(
        "\u062F\u0639\u0645 \u0627\u062A\u062C\u0627\u0647 RTL \u0627\u0644\u0643\u0627\u0645\u0644 (Enable Full RTL Layout)",
        "\u0639\u0643\u0633 \u0627\u0644\u0642\u0648\u0627\u0626\u0645\u060C \u0627\u0644\u0642\u0646\u0648\u0627\u062A\u060C \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A\u060C \u0648\u0627\u0644\u0646\u0648\u0627\u0641\u0630 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0645\u0646 \u0627\u0644\u064A\u0645\u064A\u0646 \u0625\u0644\u0649 \u0627\u0644\u064A\u0633\u0627\u0631.",
        rtlCheckbox
      )
    );
    const updateBtn = document.createElement("button");
    updateBtn.type = "button";
    updateBtn.setAttribute("data-action", "updateTranslations");
    updateBtn.className = "bd-button bd-button-filled bd-button-color-brand";
    updateBtn.textContent = "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062A\u0631\u062C\u0645\u0627\u062A \u0627\u0644\u0622\u0646";
    updateBtn.style.padding = "8px 16px";
    updateBtn.style.cursor = "pointer";
    updateBtn.addEventListener("click", () => {
      const action = findToolboxAction(
        index_default.toolboxActions?.(),
        "arabic-discord-update-translations"
      );
      action?.();
    });
    container.appendChild(
      createSettingRow(
        "\u0645\u0632\u0627\u0645\u0646\u0629 \u0648\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0642\u0627\u0645\u0648\u0633",
        "\u062C\u0644\u0628 \u0623\u062D\u062F\u062B \u062A\u0631\u062C\u0645\u0627\u062A \u0648\u0627\u062C\u0647\u0629 \u062F\u064A\u0633\u0643\u0648\u0631\u062F \u0648\u062A\u062D\u062F\u064A\u062B\u0627\u062A \u0627\u0644\u0646\u0635\u0648\u0635 \u0645\u0646 GitHub \u0641\u0648\u0631\u064B\u0627.",
        updateBtn
      )
    );
    return container;
  }
};
/**
 * discord-intl
 *
 * @copyright 2024 Discord, Inc.
 * @link https://github.com/discord/discord-intl
 * @license MIT
 */

if (module.exports && module.exports.default) { module.exports = module.exports.default; }
