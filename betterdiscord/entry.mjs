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

        // Signature banner
        const banner = document.createElement("div");
        banner.style.display = "flex";
        banner.style.alignItems = "center";
        banner.style.justifyContent = "space-between";
        banner.style.padding = "14px 18px";
        banner.style.borderRadius = "10px";
        banner.style.background =
            "linear-gradient(135deg, rgba(88, 101, 242, 0.22), rgba(114, 137, 218, 0.08))";
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

        // 1. Arabic Font selector
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
                "الخط العربي (Arabic Font)",
                "اختر من بين الخطوط العربية المدمجة أو خط النظام للواجهة والنصوص.",
                fontSelect,
            ),
        );

        // 2. Font Scale slider (90% - 120%)
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
                "حجم الخط العربي (Font Size)",
                "تحكّم في نسبة تكبير أو تصغير النصوص العربية من 90% إلى 120%.",
                scaleWrap,
            ),
        );

        // 3. Full RTL Layout toggle
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
                "دعم اتجاه RTL الكامل (Enable Full RTL Layout)",
                "عكس القوائم، القنوات، الإعدادات، والنوافذ بالكامل من اليمين إلى اليسار.",
                rtlCheckbox,
            ),
        );

        // 4. Remote Dictionary Manual Update Button
        const updateBtn = document.createElement("button");
        updateBtn.type = "button";
        updateBtn.setAttribute("data-action", "updateTranslations");
        updateBtn.className = "bd-button bd-button-filled bd-button-color-brand";
        updateBtn.textContent = "تحديث الترجمات الآن";
        updateBtn.style.padding = "8px 16px";
        updateBtn.style.cursor = "pointer";
        updateBtn.addEventListener("click", () => {
            const action = findToolboxAction(
                plugin.toolboxActions?.(),
                "arabic-discord-update-translations",
            );
            action?.();
        });
        container.appendChild(
            createSettingRow(
                "مزامنة وتحديث القاموس",
                "جلب أحدث ترجمات واجهة ديسكورد وتحديثات النصوص من GitHub فورًا.",
                updateBtn,
            ),
        );

        return container;
    }
}
