/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { Paragraph } from "@components/Paragraph";
import { runtimeHashMessageKey } from "@utils/intlHash";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { find, waitFor } from "@webpack";
import { FluxDispatcher, i18n, LocaleStore, Menu, moment, React, showToast } from "@webpack/common";

import managedStyle from "./styles.css?managed";
import { isValidDictionaries } from "./validation.mjs";

const logger = new Logger("ArabicDiscord");

const REMOTE_REPO_BASE = "https://raw.githubusercontent.com/7madh1/ArabicDiscord/main";
const REMOTE_AR_URL = `${REMOTE_REPO_BASE}/ar.json`;
const REMOTE_COMPLEX_URL = `${REMOTE_REPO_BASE}/complex_ar.json`;
const DS_AR_KEY = "ArabicDiscord_ar_v1";
const DS_COMPLEX_KEY = "ArabicDiscord_complex_v1";
const DS_META_KEY = "ArabicDiscord_meta_v1";
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

type TranslationDict = {
    byKey?: Record<string, string>;
    byText?: Record<string, string>;
};

interface TranslationMeta {
    updatedAt: number;
    arCount: number;
    complexCount: number;
}

let activeDict: TranslationDict = {};
let complexArMap = new Map<string, unknown[]>();
let isCheckingRemoteUpdates = false;
let lifecycleGeneration = 0;
let activeFetchController: AbortController | null = null;
const seenUntranslated = new Set<string>();
const HAS_LATIN_RE = /[A-Za-z]/;
const HAS_DIGIT_RE = /\d/;
const NEEDS_NORM_RE = /[\u2018\u2019\u201C\u201D\n\r\t]|\s{2,}/;
const FONT_LINK_ID = "vc-arabic-font-link";
const LOOKUP_CACHE_LIMIT = 2048;

interface ArabicFontDef {
    id: string;
    label: string;
    stack: string;
    googleFamily: string | null;
    default?: boolean;
}

const ARABIC_FONTS: readonly ArabicFontDef[] = [
    {
        id: "cairo",
        label: "Cairo (عصري وواضح)",
        stack: '"Cairo", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
        googleFamily: "Cairo:wght@400;500;600;700;800",
        default: true,
    },
    {
        id: "tajawal",
        label: "Tajawal (ناعم ومريح)",
        stack: '"Tajawal", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
        googleFamily: "Tajawal:wght@400;500;700",
    },
    {
        id: "almarai",
        label: "Almarai (أنيق ومتناسق)",
        stack: '"Almarai", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
        googleFamily: "Almarai:wght@400;700;800",
    },
    {
        id: "alexandria",
        label: "Alexandria (هندسي عصري)",
        stack: '"Alexandria", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
        googleFamily: "Alexandria:wght@400;500;600;700",
    },
    {
        id: "ibm",
        label: "IBM Plex Sans Arabic (احترافي)",
        stack: '"IBM Plex Sans Arabic", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
        googleFamily: "IBM+Plex+Sans+Arabic:wght@400;500;600;700",
    },
    {
        id: "noto",
        label: "Noto Sans Arabic (رسمي ومتوازن)",
        stack: '"Noto Sans Arabic", "gg sans", "Segoe UI", sans-serif',
        googleFamily: "Noto+Sans+Arabic:wght@400;500;600;700",
    },
    {
        id: "readex",
        label: "Readex Pro (تقني ونظيف)",
        stack: '"Readex Pro", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
        googleFamily: "Readex+Pro:wght@400;500;600;700",
    },
    {
        id: "rubik",
        label: "Rubik (دائري ومودرن)",
        stack: '"Rubik", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
        googleFamily: "Rubik:wght@400;500;600;700",
    },
    {
        id: "vazirmatn",
        label: "Vazirmatn (مضغوط للشاشات)",
        stack: '"Vazirmatn", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
        googleFamily: "Vazirmatn:wght@400;500;600;700",
    },
    {
        id: "changa",
        label: "Changa (عريض وجريء)",
        stack: '"Changa", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
        googleFamily: "Changa:wght@400;500;600;700",
    },
    {
        id: "messiri",
        label: "El Messiri (جمالي وأنيق)",
        stack: '"El Messiri", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
        googleFamily: "El+Messiri:wght@400;500;600;700",
    },
    {
        id: "kufi",
        label: "Noto Kufi Arabic (كوفي حديث)",
        stack: '"Noto Kufi Arabic", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
        googleFamily: "Noto+Kufi+Arabic:wght@400;500;600;700",
    },
    {
        id: "zain",
        label: "Zain (انسيابي ومميز)",
        stack: '"Zain", "gg sans", "Noto Sans Arabic", "Segoe UI", sans-serif',
        googleFamily: "Zain:wght@400;700;800",
    },
    {
        id: "system",
        label: "خط النظام (Segoe UI)",
        stack: '"Segoe UI", Tahoma, "gg sans", sans-serif',
        googleFamily: null,
    },
];

const ARABIC_FONT_MAP = new Map<string, ArabicFontDef>(ARABIC_FONTS.map(f => [f.id, f]));
const DEFAULT_ARABIC_FONT = ARABIC_FONTS[0];
const lookupCache = new Map<string, string | null>();
let translatedNodeValues = new WeakMap<Node, string>();
let translatedPlaceholders = new WeakMap<Element, string>();
let cachedLookups: LookupMaps | null = null;
let stopDomFallbackFn: (() => void) | null = null;

function exportUntranslatedToFile() {
    const dump: Record<string, string> = {};
    const lookups = cachedLookups ?? buildTranslationLookups();
    const allCachedKeys = Object.keys(i18n?.t ?? {});
    const strFn = patchedTargets[0]?.originals.string ?? i18n?.intl?.string;

    for (const hash of allCachedKeys) {
        try {
            const text = strFn?.call(i18n.intl, i18n.t[hash]);
            if (typeof text === "string" && text.trim() && !lookupString(text, lookups)) {
                dump[text] = "";
            }
        } catch {
            // Ignore messages requiring format arguments
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

    return (
        <div className="vc-arabic-actions-card">
            <Flex flexDirection="column" gap="0.75em">
                <Paragraph size="md" weight="semibold" style={{ color: "var(--text-strong)" }}>
                    حالة القاموس والأدوات السريعة
                </Paragraph>
                <div className="vc-arabic-stats-row">
                    <span className="vc-arabic-stat-pill">
                        النصوص البسيطة: {simpleCount.toLocaleString("en-US")}
                    </span>
                    <span className="vc-arabic-stat-pill">
                        الرسائل المعقدة: {complexCount.toLocaleString("en-US")}
                    </span>
                    <span className="vc-arabic-stat-pill">مرصود حالياً: {capturedCount}</span>
                </div>
                <Flex gap="0.65em" style={{ flexWrap: "wrap", marginTop: "0.25em" }}>
                    <Button
                        variant="primary"
                        size="small"
                        onClick={() => {
                            const count = exportUntranslatedToFile();
                            setCapturedCount(seenUntranslated.size);
                            showToast({
                                text: `تم تصدير ${count} نص غير مترجم`,
                                variant: "success",
                            });
                        }}
                    >
                        تصدير النصوص غير المترجمة (JSON)
                    </Button>
                    {capturedCount > 0 && (
                        <Button
                            variant="secondary"
                            size="small"
                            onClick={() => {
                                seenUntranslated.clear();
                                setCapturedCount(0);
                                showToast({ text: "تم مسح النصوص المرصودة", variant: "success" });
                            }}
                        >
                            مسح المرصود
                        </Button>
                    )}
                    <Button variant="secondary" size="small" onClick={() => location.reload()}>
                        إعادة تحميل ديسكورد
                    </Button>
                </Flex>
            </Flex>
        </div>
    );
}

const settings = definePluginSettings({
    arabicFont: {
        type: OptionType.SELECT,
        displayName: "Arabic Font",
        description: "Choose the font used for Arabic UI and text",
        options: ARABIC_FONTS.map(f => ({
            label: f.label,
            value: f.id,
            default: f.default,
        })),
        onChange: applyStylesFromSettings,
    },
    fontScale: {
        type: OptionType.SLIDER,
        displayName: "Font Size",
        description: "Scale Arabic UI text size (%)",
        markers: [90, 95, 100, 105, 110, 115, 120],
        default: 100,
        stickToMarkers: false,
        onChange: applyStylesFromSettings,
    },
    enableRtl: {
        type: OptionType.BOOLEAN,
        displayName: "Enable Full RTL Layout",
        description: "Mirror Discord menus and windows from right to left",
        default: false,
        onChange: applyStylesFromSettings,
    },
    captureUntranslated: {
        type: OptionType.BOOLEAN,
        displayName: "Capture Untranslated Strings",
        description: "Log newly spotted English strings while browsing Discord",
        default: false,
        hidden: !IS_DEV,
    },
    quickTools: {
        type: OptionType.COMPONENT,
        component: ActionsPanel,
        hidden: !IS_DEV,
    },
});

const ARABIC_MONTHS = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
];
const ARABIC_WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const ARABIC_WEEKDAYS_SHORT = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const ARABIC_DATE_LOCALE = "ar-u-nu-latn";
let prevMomentLocale: string | null = null;
let prevIntlLocale: string | null = null;
let arabicLocaleDefined = false;
interface PatchedDateFormatterEntry {
    target: Record<string, any>;
    orig: (locale?: string, opts?: Intl.DateTimeFormatOptions) => (d: Date | number) => string;
}

const patchedDateFormatters: PatchedDateFormatterEntry[] = [];
let isSyncingDateLocale = false;

function patchNativeDateFormatter(): boolean {
    if (!active) return false;

    const candidates: Array<Record<string, any> | undefined> = [
        (window as any).DiscordNative?.nativeModules?.requireModule?.("discord_utils"),
    ];
    try {
        const mod = find(m => typeof m?.getDiscordUtils === "function");
        candidates.push(mod?.getDiscordUtils?.());
    } catch {
        // Ignore if webpack module isn't loaded yet
    }

    let patchedAny = false;
    for (const utils of candidates) {
        if (
            !utils ||
            typeof utils.createDateFormatter !== "function" ||
            patchedDateFormatters.some(p => p.target === utils)
        ) {
            continue;
        }
        const orig = utils.createDateFormatter;
        patchedDateFormatters.push({ target: utils, orig });
        utils.createDateFormatter = function (locale?: string, opts?: Intl.DateTimeFormatOptions) {
            if (active) {
                try {
                    const fmt = new Intl.DateTimeFormat(ARABIC_DATE_LOCALE, opts);
                    return (date: Date | number) => fmt.format(date).replace(/\u200f/g, "");
                } catch {
                    // Fall back to native formatter on invalid options
                }
            }
            return orig.call(this, locale, opts);
        };
        patchedAny = true;
    }
    return patchedAny;
}

function restoreNativeDateFormatter(): boolean {
    const restored = patchedDateFormatters.length > 0;
    while (patchedDateFormatters.length > 0) {
        const entry = patchedDateFormatters.pop()!;
        entry.target.createDateFormatter = entry.orig;
    }
    return restored;
}

function formatArabicUnit(
    n: number,
    single: string,
    dual: string,
    few: string,
    many: string,
    display = String(n),
): string {
    if (n === 1) return single;
    if (n === 2) return dual;
    const mod100 = n % 100;
    if (mod100 >= 3 && mod100 <= 10) return `${display} ${few}`;
    return `${display} ${many}`;
}

function applyArabicMomentLocale(): boolean {
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
                    weekdaysMin: ["ح", "ن", "ث", "ر", "خ", "ج", "س"],
                    longDateFormat: {
                        LT: "h:mm A",
                        LTS: "h:mm:ss A",
                        L: "DD/MM/YYYY",
                        LL: "D MMMM YYYY",
                        LLL: "D MMMM YYYY h:mm A",
                        LLLL: "dddd D MMMM YYYY h:mm A",
                    },
                    meridiemParse: /[صم]/,
                    isPM: (input: string) => input === "م",
                    meridiem: (hour: number) => (hour < 12 ? "ص" : "م"),
                    calendar: {
                        sameDay: "[اليوم الساعة] LT",
                        nextDay: "[غداً الساعة] LT",
                        nextWeek: "dddd [الساعة] LT",
                        lastDay: "[أمس الساعة] LT",
                        lastWeek: "dddd الماضي [الساعة] LT",
                        sameElse: "L",
                    },
                    relativeTime: {
                        future: "خلال %s",
                        past: "منذ %s",
                        s: "ثوانٍ",
                        ss: (n: number) => formatArabicUnit(n, "ثانية", "ثانيتين", "ثوانٍ", "ثانية"),
                        m: "دقيقة",
                        mm: (n: number) => formatArabicUnit(n, "دقيقة", "دقيقتين", "دقائق", "دقيقة"),
                        h: "ساعة",
                        hh: (n: number) => formatArabicUnit(n, "ساعة", "ساعتين", "ساعات", "ساعة"),
                        d: "يوم",
                        dd: (n: number) => formatArabicUnit(n, "يوم", "يومين", "أيام", "يومًا"),
                        M: "شهر",
                        MM: (n: number) => formatArabicUnit(n, "شهر", "شهرين", "أشهر", "شهرًا"),
                        y: "سنة",
                        yy: (n: number) => formatArabicUnit(n, "سنة", "سنتين", "سنوات", "سنة"),
                    },
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
        // Ignore if moment isn't ready yet
    }
    return false;
}

function applyArabicDateSystem(forceEmit = false) {
    if (isSyncingDateLocale) return;
    isSyncingDateLocale = true;
    try {
        const enableDates = active;
        let changed = enableDates
            ? patchNativeDateFormatter()
            : restoreNativeDateFormatter();
        if (applyArabicMomentLocale()) changed = true;

        const intlObj = i18n?.intl as
            | (Record<string, any> & {
                  currentLocale?: string;
                  setLocale?: (locale: string) => void;
              })
            | undefined;

        if (intlObj && typeof intlObj.setLocale === "function") {
            if (enableDates) {
                if (
                    !prevIntlLocale &&
                    intlObj.currentLocale &&
                    intlObj.currentLocale !== ARABIC_DATE_LOCALE
                ) {
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

        if (changed || (forceEmit && enableDates)) {
            // مسح كاش DateUtils الداخلي عند تغير حالة التعريب أو في التزامن النهائي
            try {
                const store = LocaleStore as unknown as
                    | {
                          _changeCallbacks?: { invokeAll?: () => void };
                          emitChange?: () => void;
                      }
                    | undefined;
                store?._changeCallbacks?.invokeAll?.();
                store?.emitChange?.();
            } catch {
                // Ignore if LocaleStore isn't initialized yet
            }
        }
    } finally {
        isSyncingDateLocale = false;
    }
}

const onDiscordLocaleFlux = () => {
    if (!active) return;
    queueMicrotask(() => {
        if (active) {
            applyArabicDateSystem();
        }
    });
};

let dateSyncTimeoutId: number | null = null;

let isApplyingRootStyles = false;
let rootAttrObserver: MutationObserver | null = null;

function syncArabicFontLink(googleFamily: string | null) {
    const { head } = document;
    if (!head) return;

    const existing = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
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

function getSelectedFontDef(): ArabicFontDef {
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
        attributeFilter: ["dir", "style", "data-arabic-rtl", "data-arabic-font"],
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

function formatPlainTemplate(template: string, values?: Record<string, unknown>): string {
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (full, key) =>
        Object.hasOwn(values, key) ? String(values[key]) : full,
    );
}

function formatRichTemplate(template: string, values?: Record<string, unknown>): unknown {
    if (!values) return template;
    const entries = Object.values(values);
    const hasNonPrimitive = entries.some(
        v => v !== null && (typeof v === "object" || typeof v === "function"),
    );
    if (!hasNonPrimitive) {
        return formatPlainTemplate(template, values);
    }

    const parts: unknown[] = [];
    const regex = /\{(\w+)\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

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

type IntlMethod = (...args: any[]) => any;

interface PatchedIntlTarget {
    target: Record<string, IntlMethod>;
    originals: Partial<
        Record<"string" | "format" | "formatToPlainString" | "formatToMarkdownString", IntlMethod>
    >;
}

interface LookupMaps {
    byTextMap: Map<string, string>;
    byNormMap: Map<string, string> | null;
}

const patchedTargets: PatchedIntlTarget[] = [];
let byAccessor = new WeakMap<object, string>();
let active = false;
let domObserver: MutationObserver | null = null;

function normalizeText(text: string): string {
    const trimmed = text.trim();
    if (!trimmed || !NEEDS_NORM_RE.test(trimmed)) return trimmed;
    return trimmed
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\s+/g, " ");
}

function resolveKeyToHash(key: string): string {
    return key.startsWith("#") ? key.slice(1) : runtimeHashMessageKey(key);
}

function getStaticLookups(): LookupMaps {
    if (cachedLookups) return cachedLookups;

    const { byText } = activeDict;
    const byTextMap = new Map<string, string>();

    for (const [enText, arText] of Object.entries(byText ?? {})) {
        if (!arText || arText === enText) continue;
        byTextMap.set(enText, arText);
    }

    cachedLookups = { byTextMap, byNormMap: null };
    return cachedLookups;
}

function getNormLookupMap(lookups: LookupMaps): Map<string, string> {
    if (lookups.byNormMap) return lookups.byNormMap;

    const byNormMap = new Map<string, string>();
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
        const hash = resolveKeyToHash(rawKey);
        try {
            const accessor = i18n.t[hash];
            if (
                accessor &&
                (typeof accessor === "function" || typeof accessor === "object") &&
                !byAccessor.has(accessor as object)
            ) {
                byAccessor.set(accessor as object, arText);
            }
        } catch {
            // Ignore proxy lookup errors for unknown keys
        }
    }
}

function buildTranslationLookups(): LookupMaps {
    const lookups = getStaticLookups();
    populateKeyAccessors();
    return lookups;
}

const DYNAMIC_NUMBER_PATTERNS: Array<[RegExp, string]> = [
    [/^Save (\d+%) on Nitro$/i, "وفّر $1 على نيترو"],
    [/^(\d+%) DISCOUNT$/i, "خصم $1"],
    [/^(\d+%) OFF$/i, "خصم $1"],
    [/^Get (\d+%) off (.+) items!$/i, "احصل على خصم $1 على عناصر $2!"],
    [/^(\d+\/\d+) Boosts$/i, "$1 تعزيز"],
    [/^Level (\d+)$/i, "المستوى $1"],
    [/^Manage Members \(([\d,]+)\)$/i, "إدارة الأعضاء ($1)"],
    [/^Roles\s*[–-]\s*([\d,]+)$/i, "الأدوار – $1"],
    [/^Members:\s*([\d,]+)$/i, "الأعضاء: $1"],
    [/^Online:\s*([\d,]+)$/i, "المتصلون: $1"],
    [/^([\d,]+) Online$/i, "$1 متصل"],
    [/^View ([\d,]+) more$/i, "عرض $1 المزيد"],
    [/^Earn ([\d,]+) Orbs$/i, "اكسب $1 كرة"],
    [/^([\d,]+) Orbs redeemed all time$/i, "تم استبدال $1 كرة إجمالاً"],
    [/^Unlock\s+(\d+(?:\.\d+)?)\s*x$/i, "افتح مضاعفة $1×"],
    [/^(\d+(?:\.\d+)?)\s*x$/i, "$1×"],
    [/^Send\s+([\d,]+)\s+gifts?\s+to\s+unlock\s+this\s+badge\.?$/i, "أرسل $1 هدايا لفتح هذه الشارة."],
    [/^Boost\s+([\d,]+)\s+servers?\s+to\s+unlock\s+this\s+badge\.?$/i, "عزّز $1 سيرفرات لفتح هذه الشارة."],
    [/^(.+) removed you as a friend\.$/i, "قام $1 بإزالتك من قائمة الأصدقاء."],
    [/^A friend request from (.+) has been removed\.$/i, "تم إلغاء طلب الصداقة من $1."],
    [/^You were removed from the server (.+)\.$/i, "تمت إزالتك من سيرفر $1."],
    [/^You were removed from the group (.+)\.$/i, "تمت إزالتك من مجموعة $1."],
];

interface DynamicPluralPattern {
    re: RegExp;
    prefix?: string;
    supportsPlus?: boolean;
    single: string;
    dual: string;
    few: string;
    many: string;
}

const DYNAMIC_PLURAL_PATTERNS: DynamicPluralPattern[] = [
    { re: /^([\d,]+)\s+Server Boosts?$/i, single: "تعزيز واحد للسيرفر", dual: "تعزيزان للسيرفر", few: "تعزيزات للسيرفر", many: "تعزيزًا للسيرفر" },
    { re: /^([\d,]+)\s+Boosts?$/i, single: "تعزيز واحد", dual: "تعزيزان", few: "تعزيزات", many: "تعزيزًا" },
    { re: /^([\d,]+)\s+Mutual Servers?$/i, single: "سيرفر مشترك واحد", dual: "سيرفران مشتركان", few: "سيرفرات مشتركة", many: "سيرفرًا مشتركًا" },
    { re: /^([\d,]+)\s+Mutual Friends?$/i, single: "صديق مشترك واحد", dual: "صديقان مشتركان", few: "أصدقاء مشتركون", many: "صديقًا مشتركًا" },
    { re: /^([\d,]+)\s+Members?$/i, single: "عضو واحد", dual: "عضوان", few: "أعضاء", many: "عضوًا" },
    { re: /^([\d,]+)\s+repl(?:y|ies)$/i, single: "رد واحد", dual: "ردّان", few: "ردود", many: "ردًا" },
    { re: /^([\d,]+)\s+reactions?$/i, single: "تفاعل واحد", dual: "تفاعلان", few: "تفاعلات", many: "تفاعلًا" },
    { re: /^([\d,]+)\s+Votes?$/i, single: "صوت واحد", dual: "صوتان", few: "أصوات", many: "صوتًا" },
    { re: /^([\d,]+)\s+new messages?$/i, single: "رسالة جديدة", dual: "رسالتان جديدتان", few: "رسائل جديدة", many: "رسالة جديدة" },
    { re: /^([\d,]+)\s+unread messages?$/i, single: "رسالة غير مقروءة", dual: "رسالتان غير مقروءتين", few: "رسائل غير مقروءة", many: "رسالة غير مقروءة" },
    { re: /^([\d,]+)\s+games?\s+played$/i, single: "لعبة واحدة مُلعَبة", dual: "لعبتان مُلعَبتان", few: "ألعاب مُلعَبة", many: "لعبة مُلعَبة" },
    { re: /^([\d,]+)\s+hours?\s+of\s+games?\s+played$/i, single: "ساعة لعب واحدة", dual: "ساعتا لعب", few: "ساعات لعب", many: "ساعة لعب" },
    { re: /^([\d,]+)\s+hours?\s+streamed\s+to\s+others$/i, single: "ساعة بث واحدة للآخرين", dual: "ساعتا بث للآخرين", few: "ساعات بث للآخرين", many: "ساعة بث للآخرين" },
    { re: /^([\d,]+)\s+hours?\s+streamed$/i, single: "ساعة بث واحدة", dual: "ساعتا بث", few: "ساعات بث", many: "ساعة بث" },
    { re: /^([\d,]+)\s+Quests?\s+completed$/i, single: "مهمة واحدة مكتملة", dual: "مهمتان مكتملتان", few: "مهام مكتملة", many: "مهمة مكتملة" },
    { re: /^([\d,]+)(\+)?\s+gifts?$/i, supportsPlus: true, single: "هدية واحدة", dual: "هديتان", few: "هدايا", many: "هدية" },
    { re: /^([\d,]+)(\+)?\s+months?$/i, supportsPlus: true, single: "شهر واحد", dual: "شهران", few: "أشهر", many: "شهرًا" },
    { re: /^([\d,]+)(\+)?\s+years?$/i, supportsPlus: true, single: "سنة واحدة", dual: "سنتان", few: "سنوات", many: "سنة" },
    { re: /^([\d,]+)(\+)?\s+weeks?$/i, supportsPlus: true, single: "أسبوع واحد", dual: "أسبوعان", few: "أسابيع", many: "أسبوعًا" },
    { re: /^([\d,]+)(\+)?\s+days?$/i, supportsPlus: true, single: "يوم واحد", dual: "يومان", few: "أيام", many: "يومًا" },
    { re: /^([\d,]+)(\+)?\s+hours?$/i, supportsPlus: true, single: "ساعة واحدة", dual: "ساعتان", few: "ساعات", many: "ساعة" },
    { re: /^([\d,]+)(\+)?\s+minutes?$/i, supportsPlus: true, single: "دقيقة واحدة", dual: "دقيقتان", few: "دقائق", many: "دقيقة" },
    { re: /^([\d,]+)\s+others?$/i, single: "شخص آخر", dual: "شخصان آخران", few: "أشخاص آخرون", many: "شخصًا آخر" },
    { re: /^(\d+) years? ago$/i, prefix: "منذ ", single: "سنة", dual: "سنتين", few: "سنوات", many: "سنة" },
    { re: /^(\d+) months? ago$/i, prefix: "منذ ", single: "شهر", dual: "شهرين", few: "أشهر", many: "شهرًا" },
    { re: /^(\d+) days? ago$/i, prefix: "منذ ", single: "يوم", dual: "يومين", few: "أيام", many: "يومًا" },
    { re: /^(\d+) hours? ago$/i, prefix: "منذ ", single: "ساعة", dual: "ساعتين", few: "ساعات", many: "ساعة" },
    { re: /^(\d+) minutes? ago$/i, prefix: "منذ ", single: "دقيقة", dual: "دقيقتين", few: "دقائق", many: "دقيقة" },
    { re: /^([\d,]+)\s+Orbs$/i, single: "كرة واحدة", dual: "كرتان", few: "كرات", many: "كرة" },
];

const YEARS_MONTHS_RE = /^([\d,]+)\s+years?,\s*([\d,]+)\s+months?$/i;
const YEARS_DAYS_RE = /^([\d,]+)\s+years?,\s*([\d,]+)\s+days?$/i;
const MONTHS_DAYS_RE = /^([\d,]+)\s+months?,\s*([\d,]+)\s+days?$/i;
const HOURS_STREAMED_TO_N_OTHERS_RE = /^([\d,]+)\s+hours?\s+streamed\s+to\s+([\d,]+)\s+others?$/i;
const STREAMED_TO_N_OTHERS_RE = /^hours?\s+streamed\s+to\s+([\d,]+)\s+others?$/i;

function formatDynamicCompound(norm: string): string | undefined {
    let m = YEARS_MONTHS_RE.exec(norm);
    if (m) {
        const y = formatArabicUnit(Number(m[1].replace(/,/g, "")), "سنة واحدة", "سنتان", "سنوات", "سنة", m[1]);
        const mo = formatArabicUnit(Number(m[2].replace(/,/g, "")), "شهر واحد", "شهران", "أشهر", "شهرًا", m[2]);
        return `${y} و${mo}`;
    }
    m = YEARS_DAYS_RE.exec(norm);
    if (m) {
        const y = formatArabicUnit(Number(m[1].replace(/,/g, "")), "سنة واحدة", "سنتان", "سنوات", "سنة", m[1]);
        const d = formatArabicUnit(Number(m[2].replace(/,/g, "")), "يوم واحد", "يومان", "أيام", "يومًا", m[2]);
        return `${y} و${d}`;
    }
    m = MONTHS_DAYS_RE.exec(norm);
    if (m) {
        const mo = formatArabicUnit(Number(m[1].replace(/,/g, "")), "شهر واحد", "شهران", "أشهر", "شهرًا", m[1]);
        const d = formatArabicUnit(Number(m[2].replace(/,/g, "")), "يوم واحد", "يومان", "أيام", "يومًا", m[2]);
        return `${mo} و${d}`;
    }
    m = HOURS_STREAMED_TO_N_OTHERS_RE.exec(norm);
    if (m) {
        const h = formatArabicUnit(Number(m[1].replace(/,/g, "")), "ساعة بث واحدة", "ساعتا بث", "ساعات بث", "ساعة بث", m[1]);
        const o = formatArabicUnit(Number(m[2].replace(/,/g, "")), "شخص آخر", "شخصين آخرين", "أشخاص آخرين", "شخصًا آخر", m[2]);
        return `${h} لـ ${o}`;
    }
    m = STREAMED_TO_N_OTHERS_RE.exec(norm);
    if (m) {
        const o = formatArabicUnit(Number(m[1].replace(/,/g, "")), "شخص آخر", "شخصين آخرين", "أشخاص آخرين", "شخصًا آخر", m[1]);
        return `ساعات بث لـ ${o}`;
    }
    return undefined;
}

const DYNAMIC_TEXT_PATTERNS: Array<[RegExp, string]> = [
    [
        /^Plans start at only (.+)\/month\. Cancel anytime$/i,
        "الخطط تبدأ من $1/شهرياً فقط. الإلغاء في أي وقت",
    ],
    [/^Message (#.+)$/i, "أرسل رسالة في $1"],
    [/^Message (@.+)$/i, "أرسل رسالة إلى $1"],
    [/^Search (.+)$/i, "بحث في $1"],
    [/^Edit Role — (.+)$/i, "تعديل الدور — $1"],
    [/^Invite friends to (.+)$/i, "دعوة أصدقاء إلى $1"],
    [/^Welcome to (.+)!$/i, "أهلاً بك في $1!"],
    [/^This is the start of the (#.+) channel\.$/i, "هذه بداية قناة $1."],
    [/^Playing (.+)$/i, "يلعب $1"],
    [/^Watching (.+)$/i, "يشاهد $1"],
    [/^Listening to (.+)$/i, "يستمع إلى $1"],
    [/^Streaming (.+)$/i, "يبث $1"],
];

const EN_MONTH_TO_AR: Record<string, string> = {
    january: "يناير",
    february: "فبراير",
    march: "مارس",
    april: "أبريل",
    may: "مايو",
    june: "يونيو",
    july: "يوليو",
    august: "أغسطس",
    september: "سبتمبر",
    october: "أكتوبر",
    november: "نوفمبر",
    december: "ديسمبر",
};

const FULL_DATE_RE =
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})$/i;
const CALENDAR_TIME_RE = /^(Today|Yesterday) at (\d{1,2}:\d{2})(?:\s*(AM|PM))?$/i;

function cacheLookupResult(key: string, result: string | undefined): string | undefined {
    if (lookupCache.size >= LOOKUP_CACHE_LIMIT) {
        lookupCache.clear();
    }
    lookupCache.set(key, result ?? null);
    return result;
}

function formatRegexReplacement(match: RegExpExecArray, template: string): string {
    return template.replace(/\$(\d+)/g, (_, idx) => match[Number(idx)] ?? "");
}

function lookupString(raw: string, lookups: LookupMaps): string | undefined {
    if (!HAS_LATIN_RE.test(raw)) return undefined;

    const direct = lookups.byTextMap.get(raw);
    if (direct) return direct;

    const cached = lookupCache.get(raw);
    if (cached !== undefined) return cached ?? undefined;

    const norm = normalizeText(raw);
    if (norm !== raw) {
        const exactNorm = lookups.byTextMap.get(norm);
        if (exactNorm) return cacheLookupResult(raw, exactNorm);
    }

    if (HAS_DIGIT_RE.test(norm)) {
        const calMatch = CALENDAR_TIME_RE.exec(norm);
        if (calMatch) {
            const dayWord = calMatch[1].toLowerCase() === "today" ? "اليوم" : "أمس";
            const meridiem = calMatch[3]
                ? calMatch[3].toUpperCase() === "AM"
                    ? " ص"
                    : " م"
                : "";
            return cacheLookupResult(raw, `${dayWord} الساعة ${calMatch[2]}${meridiem}`);
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
                rawNum,
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
    return cacheLookupResult(raw, undefined);
}

function recordUntranslated(value: unknown) {
    if (!IS_DEV || !settings.store.captureUntranslated) return;
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 180) return;
    // تجاهل النصوص العربية، الأرقام، الروابط، الإشارات، والرموز المجردة
    if (!/[A-Za-z]{2,}/.test(trimmed)) return;
    if (/[\u0600-\u06FF]/.test(trimmed)) return;
    if (/^(https?:\/\/|@|#|\d+[:/.,-]\d+)/i.test(trimmed)) return;
    if (/^(Today|Yesterday) at \d/i.test(trimmed) || FULL_DATE_RE.test(trimmed)) return;
    seenUntranslated.add(trimmed);
}

function translateOutput(out: unknown, lookups: LookupMaps): unknown {
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
        const mapped = out.map(item => {
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

function patchIntlObject(target: Record<string, IntlMethod>) {
    if (!target || patchedTargets.some(p => p.target === target)) return;

    const originals: PatchedIntlTarget["originals"] = {};
    const methods = ["string", "format", "formatToPlainString", "formatToMarkdownString"] as const;

    for (const methodName of methods) {
        if (!Object.hasOwn(target, methodName) || typeof target[methodName] !== "function")
            continue;
        const orig = target[methodName];
        originals[methodName] = orig;

        target[methodName] = function (...args: unknown[]) {
            const [msg, values] = args as [unknown, Record<string, unknown> | undefined];
            if (active && msg && (typeof msg === "object" || typeof msg === "function")) {
                const direct = byAccessor.get(msg as object);
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

const SKIP_SUBTREE_SELECTORS = [
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
    "[class*='role_']",
];

const SKIP_SUBTREE_SELECTOR = SKIP_SUBTREE_SELECTORS.join(",");

const SKIP_EDITOR_SELECTOR = "[contenteditable='true'],[class*='slateTextArea_']";
const PLACEHOLDER_SELECTOR = "[class*='placeholder_'],.public-DraftEditorPlaceholder-inner";
const AUTO_DIR_SELECTOR = [
    "[class*='truncated_HigqCD']",
    "[class*='subtext_yc3axZ']",
    "[class*='activityStatusText_']",
    "[class*='subtext_zln_tS']",
    "[class*='gameName_UQqFnR']",
    "[class*='membersGroupName_']",
    "[class*='clipTitle_']",
].join(",");

function markAutoDirElement(el: Element) {
    if (el.getAttribute("dir") !== "auto") {
        el.setAttribute("dir", "auto");
    }
    if (el.getAttribute("data-arabic-auto-dir") !== "1") {
        el.setAttribute("data-arabic-auto-dir", "1");
    }
}

function syncAutoDirInSubtree(node: Node) {
    if (!settings.store.enableRtl) return;
    if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement?.closest(AUTO_DIR_SELECTOR);
        if (parent) markAutoDirElement(parent);
        return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
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

const SKIP_DOM_SELECTOR = [
    ...SKIP_SUBTREE_SELECTORS,
    "[contenteditable='true']",
    "[class*='slateTextArea_']",
].join(",");

function shouldSkipElement(el: Element | null): boolean {
    if (!el) return true;
    if (el.closest(SKIP_DOM_SELECTOR) && !el.closest(PLACEHOLDER_SELECTOR)) return true;
    return false;
}

function translateInputPlaceholder(el: Element, lookups: LookupMaps) {
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

function applyTextNodeTranslation(
    textNode: Text,
    lookups: LookupMaps,
    fromPreFilteredWalker = false,
) {
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

function translateDomNode(node: Node, lookups: LookupMaps) {
    if (!active) return;

    if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node as Text;
        if (!shouldSkipElement(textNode.parentElement)) {
            syncAutoDirInSubtree(textNode);
            applyTextNodeTranslation(textNode, lookups, true);
        }
        return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (shouldSkipElement(el)) return;
        syncAutoDirInSubtree(el);

        translateInputPlaceholder(el, lookups);
        if (el.firstElementChild === null) {
            for (let child = el.firstChild; child; child = child.nextSibling) {
                if (child.nodeType === Node.TEXT_NODE) {
                    applyTextNodeTranslation(child as Text, lookups, true);
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
                        const elem = n as Element;
                        if (
                            elem.matches(SKIP_SUBTREE_SELECTOR) &&
                            !elem.matches(PLACEHOLDER_SELECTOR)
                        ) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_SKIP;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                },
            },
        );

        let current: Node | null;
        while ((current = walker.nextNode())) {
            applyTextNodeTranslation(current as Text, lookups, true);
        }
    }
}

function startDomFallback() {
    if (domObserver || !document.body) return;

    translateDomNode(document.body, cachedLookups ?? buildTranslationLookups());

    const pendingNodes = new Set<Node>();
    let rafId: number | null = null;

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

    domObserver = new MutationObserver(mutations => {
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
                        if (!shouldSkipElement(added as Element)) {
                            pendingNodes.add(added);
                        }
                    } else if (
                        added.nodeType === Node.TEXT_NODE &&
                        !shouldSkipElement(added.parentElement)
                    ) {
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
        attributeFilter: ["placeholder"],
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

interface PatchedLoader {
    proto: Record<string, any>;
    origGet: (...args: any[]) => any;
}

let patchedLoader: PatchedLoader | null = null;
let clonedIntlMessages = new WeakMap<object, object>();

function applyLoadedDictionaries(
    arDict: TranslationDict,
    complexDict: Record<string, unknown[]>,
    triggerRerender = true,
) {
    if (!active) return;
    activeDict = arDict;
    complexArMap = new Map(Object.entries(complexDict));
    cachedLookups = null;
    lookupCache.clear();
    clonedIntlMessages = new WeakMap();
    translatedNodeValues = new WeakMap();
    translatedPlaceholders = new WeakMap();
    byAccessor = new WeakMap();

    const lookups = buildTranslationLookups();
    if (triggerRerender) {
        if (document.body) {
            translateDomNode(document.body, lookups);
        }
        applyArabicDateSystem(true);
    }
}

async function refreshRemoteTranslations(manual: boolean): Promise<boolean> {
    if (!active || isCheckingRemoteUpdates) return false;
    const gen = lifecycleGeneration;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    isCheckingRemoteUpdates = true;
    activeFetchController = controller;
    try {
        const init: RequestInit = controller
            ? { cache: "no-cache", signal: controller.signal }
            : { cache: "no-cache" };
        const [arRes, complexRes] = await Promise.all([
            fetch(REMOTE_AR_URL, init),
            fetch(REMOTE_COMPLEX_URL, init),
        ]);
        if (!active || gen !== lifecycleGeneration) return false;
        if (!arRes.ok || !complexRes.ok) {
            throw new Error(`HTTP ${arRes.status}/${complexRes.status}`);
        }
        const [arJson, complexJson] = (await Promise.all([
            arRes.json(),
            complexRes.json(),
        ])) as [TranslationDict, Record<string, unknown[]>];

        if (!active || gen !== lifecycleGeneration) return false;
        if (!isValidDictionaries(arJson, complexJson) || !arJson.byText) {
            throw new Error("Invalid or incomplete translation payload");
        }

        const arCount = Object.keys(arJson.byText).length;
        const complexCount = Object.keys(complexJson).length;

        const meta: TranslationMeta = { updatedAt: Date.now(), arCount, complexCount };
        await DataStore.setMany([
            [DS_AR_KEY, arJson],
            [DS_COMPLEX_KEY, complexJson],
            [DS_META_KEY, meta],
        ]);
        if (!active || gen !== lifecycleGeneration) return false;
        applyLoadedDictionaries(arJson, complexJson, true);
        logger.info(`Loaded remote Arabic dictionaries (${arCount} simple, ${complexCount} complex).`);

        if (manual && active && gen === lifecycleGeneration) {
            showToast({
                text: `تم تحديث القاموس (${arCount.toLocaleString("en-US")} نص)`,
                variant: "success",
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
                text: "تعذّر تحديث الترجمات من GitHub",
                variant: "critical",
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
        const [cachedAr, cachedComplex, meta] = (await DataStore.getMany([
            DS_AR_KEY,
            DS_COMPLEX_KEY,
            DS_META_KEY,
        ])) as [TranslationDict | undefined, Record<string, unknown[]> | undefined, TranslationMeta | undefined];

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

function patchLoaderPrototype(proto: Record<string, any> | null | undefined) {
    if (patchedLoader || !proto || typeof proto.get !== "function") return;

    const origGet = proto.get;
    patchedLoader = { proto, origGet };

    proto.get = function (hash: string, locale: string) {
        const origMsg = origGet.call(this, hash, locale);
        if (!active || !origMsg || origMsg === this.fallbackMessage) return origMsg;

        const cached = clonedIntlMessages.get(origMsg);
        if (cached) return cached;

        const arAst = complexArMap.get(hash);
        if (arAst) {
            const clone = Object.create(Object.getPrototypeOf(origMsg));
            clone.locale = ARABIC_DATE_LOCALE;
            clone.ast = arAst;
            clonedIntlMessages.set(origMsg, clone);
            return clone;
        }

        if (
            Array.isArray(origMsg.ast) &&
            origMsg.ast.length === 1 &&
            typeof origMsg.ast[0] === "string"
        ) {
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
        const loader = (i18n?.t as any)?.$$loader;
        if (!loader) return;
        patchLoaderPrototype(Object.getPrototypeOf(loader) as Record<string, any> | null);
    } catch {
        // Ignore if $$loader isn't initialized yet
    }
}

export default definePlugin({
    name: "ArabicDiscord",
    description: "Full Arabic localization for Discord with Arabic fonts and RTL layout support",
    authors: [{ name: "7madh", id: 0n }],
    tags: ["Appearance", "Customisation", "Utility"],
    settings,
    startAt: StartAt.Init,

    toolboxActions() {
        const { enableRtl } = settings.use(["enableRtl"]);
        return (
            <>
                <Menu.MenuCheckboxItem
                    id="arabic-discord-rtl-toggle"
                    label="Full RTL Layout"
                    checked={Boolean(enableRtl)}
                    action={() => {
                        settings.store.enableRtl = !enableRtl;
                        applyStylesFromSettings();
                    }}
                />
                <Menu.MenuItem
                    id="arabic-discord-update-translations"
                    label="Update Arabic Translations"
                    action={() => {
                        void refreshRemoteTranslations(true);
                    }}
                />
                {IS_DEV && (
                    <Menu.MenuItem
                        id="arabic-discord-export"
                        label="Export Untranslated Strings"
                        action={() => {
                            const count = exportUntranslatedToFile();
                            showToast({
                                text: `تم تصدير ${count} نص غير مترجم`,
                                variant: "success",
                            });
                        }}
                    />
                )}
            </>
        );
    },

    start() {
        lifecycleGeneration++;
        isCheckingRemoteUpdates = false;
        activeFetchController?.abort();
        activeFetchController = null;
        active = true;
        enableStyle(managedStyle);

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
            m => typeof m?.getDiscordUtils === "function",
            () => {
                if (!active) return;
                applyArabicDateSystem();
            },
        );

        waitFor(
            m => m?.getName?.() === "LocaleStore",
            () => {
                if (!active) return;
                applyArabicDateSystem(true);
            },
        );

        waitFor(["dispatch", "subscribe"], (flux: typeof FluxDispatcher) => {
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
                }, 2000);
            }
        });

        waitFor("MessageLoader", (mod: { MessageLoader?: { prototype?: Record<string, any> } }) => {
            if (!active) return;
            patchLoaderPrototype(mod?.MessageLoader?.prototype);
        });

        waitFor(
            m => m != null && Object.getPrototypeOf(m)?.withFormatters != null,
            (intlObj: Record<string, IntlMethod>) => {
                if (!active) return;
                patchIntlObject(intlObj);
                const proto = Object.getPrototypeOf(intlObj) as Record<string, IntlMethod> | null;
                if (proto) patchIntlObject(proto);
                patchMessageLoader();

                queueMicrotask(() => {
                    if (!active) return;
                    populateKeyAccessors();
                    patchMessageLoader();
                    applyArabicDateSystem();
                });
                logger.info("تم تفعيل تعريب ديسكورد بنجاح!");
            },
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
        clonedIntlMessages = new WeakMap();
        translatedNodeValues = new WeakMap();
        translatedPlaceholders = new WeakMap();
        byAccessor = new WeakMap();
        disableStyle(managedStyle);

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
            // Ignore if FluxDispatcher wasn't ready
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
            const entry = patchedTargets.pop()!;
            for (const [name, orig] of Object.entries(entry.originals)) {
                if (orig) entry.target[name] = orig;
            }
        }

        logger.info("تم إيقاف تعريب ديسكورد.");
    },
});
