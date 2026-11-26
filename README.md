<div align="center">

# ArabicDiscord

### تجربة تعريب Discord العربية الكاملة لـ **Vencord** و **BetterDiscord**

**تطوير: [`7madh`](https://github.com/7madh1) · الإصدار `v0.1.0` · متوافق مع `Discord app-1.0.9270`**

[![Validate & Build](https://github.com/7madh1/ArabicDiscord/actions/workflows/validate.yml/badge.svg)](https://github.com/7madh1/ArabicDiscord/actions/workflows/validate.yml)
[![Release](https://img.shields.io/badge/Release-v0.1.0-5865F2?style=flat-square&logo=github)](https://github.com/7madh1/ArabicDiscord/releases)
[![Vencord](https://img.shields.io/badge/Vencord-Userplugin-7289DA?style=flat-square)](https://vencord.dev)
[![BetterDiscord](https://img.shields.io/badge/BetterDiscord-Plugin-3E82E5?style=flat-square)](./betterdiscord/ArabicDiscord.plugin.js)
[![License](https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square)](./LICENSE)

</div>

---

## المميزات

- **تعريب شامل لآخر إصدار (`Discord app-1.0.9270`)**: أكثر من `20,370` نص بسيط و`6,915` رسالة تفاعلية مع صيغ الجمع العربية الكاملة (المفرد والمثنى والجمع والتمييز).
- **تحديث تلقائي وخفيف للترجمات (`DataStore` / `IndexedDB`)**: القواميس لا تُضخّم حزمة الإضافة؛ تُحمَّل عن بُعد وتُحفظ محليًا مع فحص دوري كل 6 ساعات وزر تحديث يدوي فوري.
- **دعم Vencord وBetterDiscord من نواة واحدة**: نسخة أصلية لـ Vencord ونسخة مبنية جاهزة لـ BetterDiscord مع واجهة إعدادات عربية كاملة.
- **13 خطًا عربيًا + تحجيم مرن (`90% - 120%`)**: خطوط مثل `Cairo`، `Tajawal`، `Almarai`، `Alexandria`، `IBM Plex Sans Arabic`، `Noto Sans Arabic` بالإضافة لخط النظام.
- **عكس الواجهة بالكامل (`RTL`)**: دعم اتجاه اليمين إلى اليسار مع الحفاظ على أسماء المستخدمين والكود والروابط والأرقام القياسية (`0-9`) بشكل سليم.
- **أداء عالٍ**: استخدام `WeakMap` و`LRU lookup cache` وتجميع تحديثات الـ DOM داخل `requestAnimationFrame` مع تجاوز مناطق الكتابة والكود.

---

## التثبيت التلقائي السريع (Windows)

### الطريقة الأولى: أمر PowerShell مباشر (موصى به — بدون أي تنبيه SmartScreen)
افتح **PowerShell** أو **Windows Terminal** والصق السطر التالي واضغط `Enter`:

```powershell
irm https://raw.githubusercontent.com/7madh1/ArabicDiscord/main/install.ps1 | iex
```

### الطريقة الثانية: ملف التثبيت التفاعلي
1. نزّل [`Install-ArabicDiscord.bat`](./Install-ArabicDiscord.bat) من صفحة [**Releases**](https://github.com/7madh1/ArabicDiscord/releases).
2. إذا ظهر تنبيه *Windows SmartScreen / Unknown Publisher*، اضغط كليك يمين على الملف ← **Properties** ← فعّل **Unblock** ← **OK** ثم شغّله (أو اضغط **More info ← Run anyway**).

في كلتا الطريقتين ستظهر لك القائمة لاختيار:
- **`[1] BetterDiscord`**: يثبّت [`betterdiscord/ArabicDiscord.plugin.js`](./betterdiscord/ArabicDiscord.plugin.js) ويفعّله تلقائيًا.
- **`[2] Vencord`**: يتحقق من المتطلبات ويستنسخ Vencord + ArabicDiscord ويبنيهم ويفتح أداة الحقن `pnpm.cmd inject`.
- **`[3] Update`**: يحدّث النسخة المثبتة تلقائيًا.

---

## التثبيت اليدوي

### 1) Vencord (Userplugin من المصدر)

```bash
git clone https://github.com/Vendicated/Vencord.git
cd Vencord
pnpm install
git clone https://github.com/7madh1/ArabicDiscord.git src/userplugins/arabicDiscord
pnpm build
pnpm inject
```

ثم افتح Discord: **الإعدادات ← Vencord ← Plugins ← فعّل `ArabicDiscord`**.  
*(في Windows PowerShell استخدم `pnpm.cmd` بدل `pnpm` لو كان تشغيل سكربتات `.ps1` معطلاً.)*

### 2) BetterDiscord

1. افتح [`betterdiscord/ArabicDiscord.plugin.js`](./betterdiscord/ArabicDiscord.plugin.js) واضغط **Download raw file** (أو حمّله من [**Releases**](https://github.com/7madh1/ArabicDiscord/releases)).
2. ضع الملف داخل مجلد `BetterDiscord\plugins` وفعّله من إعدادات الإضافات.

> **تنبيه مهم:** لا تُشغّل Vencord وBetterDiscord معًا على نفس تثبيت Discord لتجنب التعارض.

---

## بنية المشروع

| المسار | الدور |
| :--- | :--- |
| [`index.tsx`](./index.tsx) | نواة الإضافة الأساسية لـ Vencord (منطق التعريب، التواريخ، RTL، الخطوط، المزامنة) |
| [`styles.css`](./styles.css) | قواعد التصميم وعكس الاتجاه الكامل (`RTL`) |
| [`validation.mjs`](./validation.mjs) | مدقق مشترك صارم لبنية القواميس وعقد AST (`1..8`) |
| [`ar.json`](./ar.json) / [`complex_ar.json`](./complex_ar.json) | قواميس النصوص البسيطة والرسائل المعقدة وصيغ الجمع |
| [`betterdiscord/`](./betterdiscord) | محوّلات `BdApi` والنسخة الجاهزة [`ArabicDiscord.plugin.js`](./betterdiscord/ArabicDiscord.plugin.js) |
| [`scripts/`](./scripts) | أدوات البناء والتحقق واختبارات التشغيل ومراقبة تحديثات Discord |
| [`install.ps1`](./install.ps1) | مثبّت PowerShell المباشر (`irm \| iex`) لنظامي Vencord وBetterDiscord |
| [`Install-ArabicDiscord.bat`](./Install-ArabicDiscord.bat) | اختصار تشغيل تفاعلي للنسخة المباشرة على Windows |

---

## التطوير والاختبارات

```bash
# فحص القواميس والـ AST وCSS
node scripts/validate.mjs

# بناء/فحص نسخة BetterDiscord
node scripts/build-bd.mjs

# اختبارات المخطط ودورة التشغيل (Vencord & BetterDiscord)
node --test scripts/runtime.test.mjs

# فحص النصوص الجديدة في أحدث نسخة Discord
node scripts/check-discord-updates.mjs
```

---

## الترخيص

مرخص بموجب رخصة **GPL-3.0-or-later** متوافقة مع Vencord. راجع [LICENSE](./LICENSE).
