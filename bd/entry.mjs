/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import plugin from "../index.tsx";
import {
    abortBdWaitControllers,
    activeSettingsObject,
    resetBdWaitControllers,
} from "./shims.mjs";

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

export default class ArabicDiscord {
    start() {
        resetBdWaitControllers();
        plugin.start();
    }

    stop() {
        abortBdWaitControllers();
        plugin.stop();
    }

    getSettingsPanel() {
        const { BdApi } = globalThis;
        const settingsObj = activeSettingsObject;
        if (!BdApi?.UI || !settingsObj) {
            return document.createElement("div");
        }

        const { def, store } = settingsObj;
        const panelConfig = [
            {
                type: "dropdown",
                id: "arabicFont",
                name: "الخط العربي (Arabic Font)",
                note: "اختر الخط المستخدم للواجهة والنصوص العربية.",
                value: store.arabicFont,
                options: def.arabicFont.options.map(o => ({
                    label: o.label,
                    value: o.value,
                })),
            },
            {
                type: "slider",
                id: "fontScale",
                name: "حجم الخط (Font Size %)",
                note: "ضبط نسبة تكبير أو تصغير الخط العربي.",
                value: Number(store.fontScale) || 100,
                min: 90,
                max: 120,
                step: 5,
                digits: 0,
            },
            {
                type: "switch",
                id: "enableRtl",
                name: "تفعيل اتجاه الواجهة الكامل (Enable Full RTL Layout)",
                note: "عكس قوائم ديسكورد والنوافذ من اليمين إلى اليسار.",
                value: Boolean(store.enableRtl),
            },
        ];

        const container = document.createElement("div");
        container.dir = "rtl";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "12px";

        if (typeof BdApi.UI.buildSettingsPanel === "function") {
            const panelEl = BdApi.UI.buildSettingsPanel({
                settings: panelConfig,
                onChange: (_category, id, value) => {
                    store[id] = value;
                    def[id]?.onChange?.(value);
                },
            });
            if (panelEl instanceof Node) {
                container.appendChild(panelEl);
            }
        }

        const actionsRow = document.createElement("div");
        actionsRow.style.display = "flex";
        actionsRow.style.gap = "8px";
        actionsRow.style.paddingTop = "6px";

        const updateBtn = document.createElement("button");
        updateBtn.type = "button";
        updateBtn.className = "bd-button bd-button-filled bd-button-color-brand";
        updateBtn.textContent = "تحديث الترجمات الآن";
        updateBtn.addEventListener("click", () => {
            const action = findToolboxAction(
                plugin.toolboxActions?.(),
                "arabic-discord-update-translations",
            );
            action?.();
        });
        actionsRow.appendChild(updateBtn);
        container.appendChild(actionsRow);

        return container;
    }
}
