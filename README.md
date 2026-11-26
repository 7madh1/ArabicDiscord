# ArabicDiscord

**ArabicDiscord** هي إضافة (Userplugin) لـ [Vencord](https://vencord.dev) لتعريب واجهة Discord بالكامل باللغة العربية، مع دعم الخطوط العربية، وتنسيق التواريخ والأرقام، وخيار عكس اتجاه الواجهة بالكامل من اليمين إلى اليسار (**RTL**).

> المطور: **7madh**

---

## المميزات (Features)

- **تعريب شامل للواجهة (`Discord app-1.0.9270`)**: أكثر من `20,370` نص بسيط و`6,915` رسالة تفاعلية محدثة لآخر نسخة Discord مع صيغ الجمع العربية الكاملة (المفرد والمثنى والجمع والتمييز).
- **تحديث تلقائي وخفيف للترجمات**: تُحمَّل القواميس عن بُعد من المستودع وتُحفظ محليًا في `DataStore` (دون تضخيم حزمة `renderer.js`) مع فحص تلقائي للتحديثات وإمكانية التحديث اليدوي، بالإضافة لأداة فحص تحديثات Discord الآلية عبر GitHub Actions (`.github/workflows/discord-sync-check.yml` و`scripts/check-discord-updates.mjs`).
- **تعريب واجهة وإعدادات Vencord والإضافات**: ترجمة قوائم Vencord، الفلاتر، الوسوم، والعديد من الإضافات الشهيرة تلقائيًا.
- **خطوط عربية مدمجة وخيار تحجيم**: اختيار بين `13` خطًا عربيًا (مثل `Cairo`، `Tajawal`، `Almarai`، `Alexandria`، `IBM Plex Sans Arabic`، `Noto Sans Arabic`...) بالإضافة لخط النظام، مع شريط تغيير حجم الخط (`90%` - `120%`).
- **دعم اتجاه RTL الكامل**: عكس قوائم الدردشة والسيرفرات والإعدادات والنوافذ المنبثقة وتوافق مع إضافات مثل `BetterFolders` و`ReadAllNotificationsButton` و`BetterSessions`.
- **تواريخ وأرقام عربية نظيفة**: تعريب التواريخ النسبية وأوقات الرسائل بصيغة أرقام قياسية (`0-9`).

---

## التثبيت كـ Vencord Userplugin

1. تأكد أن لديك نسخة مبنية من مصدر [Vencord](https://docs.vencord.dev/installing/custom-plugins/).
2. انسخ هذا المجلد داخل مجلد `src/userplugins/arabicDiscord` في Vencord:
   ```bash
   git clone https://github.com/7madh1/ArabicDiscord.git src/userplugins/arabicDiscord
   ```
3. نفّذ البناء وأعد حقن Vencord:
   ```bash
   pnpm build
   pnpm inject
   ```
4. افتح Discord، ادخل إلى **الإعدادات ← Vencord ← الإضافات (Plugins)**، وفعّل **ArabicDiscord**.

---

## التثبيت على BetterDiscord

1. نزّل ملف [`betterdiscord/ArabicDiscord.plugin.js`](./betterdiscord/ArabicDiscord.plugin.js) مباشرة ([رابط التحميل المباشر](https://raw.githubusercontent.com/7madh1/ArabicDiscord/main/betterdiscord/ArabicDiscord.plugin.js)).
2. ضع الملف داخل مجلد إضافات BetterDiscord:
   - عبر **إعدادات Discord ← Plugins ← Open Plugins Folder**.
3. فعّل **ArabicDiscord** من قائمة الإضافات، ويمكنك تخصيص الخط وحجم الخط ووضع **RTL** وتحديث القواميس يدويًا من أيقونة الإعدادات بجانب الإضافة.
   *(تحذير: لا تُشغّل Vencord وBetterDiscord معًا على نفس تثبيت Discord لتجنب التعارض.)*

---

## بنية المستودع

- **الجذر (`index.tsx`, `styles.css`, `validation.mjs`, `ar.json`, `complex_ar.json`)**: نسخة **Vencord Userplugin** المتوافقة مباشرة مع الاستنساخ داخل `src/userplugins/arabicDiscord`.
- **مجلد [`betterdiscord/`](./betterdiscord)**: نسخة **BetterDiscord** الكاملة (`ArabicDiscord.plugin.js` مع محوّلات `BdApi`).

---

## الإعدادات المتاحة

- **الخط العربي (Arabic Font)**: اختيار الخط المفضل للواجهة.
- **حجم الخط (Font Size)**: ضبط نسبة حجم الخط العربي.
- **تفعيل اتجاه الواجهة الكامل (Enable Full RTL Layout)**: تفعيل أو إيقاف عكس اتجاه الواجهة (مع إمكانية تبديله سريعًا من صندوق أدوات Vencord، أو تحديث القواميس مباشرة عبر **تحديث الترجمات الآن**).

---

## التطوير والاختبارات (Development & Tests)

- **فحص القواميس والـ AST وCSS**:
  ```bash
  node scripts/validate.mjs
  ```
- **بناء/فحص نسخة BetterDiscord (`betterdiscord/ArabicDiscord.plugin.js`)**:
  ```bash
  node scripts/build-bd.mjs
  ```
- **اختبارات المخطط ودورة التشغيل (`start`/`stop` على Vencord وBetterDiscord)**:
  ```bash
  node --test scripts/runtime.test.mjs
  ```
- يتضمن المستودع أيضًا فحصًا آليًا عبر GitHub Actions (`.github/workflows/validate.yml`) يشمل التحقق الصارم من بنية AST ومخططات Node، واختبارات دورة التشغيل، و`oxfmt`، و`oxlint`، و`tsc --noEmit`، وبناء `Vencord` كاملًا مع كل دفع أو طلب دمج.

---

## الترخيص (License)

هذا المشروع مرخص بموجب رخصة **GPL-3.0-or-later** متوافقة مع مشروع Vencord. راجع ملف [LICENSE](./LICENSE).
