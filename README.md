# ArabicDiscord

**ArabicDiscord** هي إضافة (Userplugin) لـ [Vencord](https://vencord.dev) لتعريب واجهة Discord بالكامل باللغة العربية، مع دعم الخطوط العربية، وتنسيق التواريخ والأرقام، وخيار عكس اتجاه الواجهة بالكامل من اليمين إلى اليسار (**RTL**).

> المطور: **7madh**

---

## المميزات (Features)

- **تعريب شامل للواجهة**: أكثر من `20,000` نص بسيط و`6,900` رسالة تفاعلية مع صيغ الجمع العربية الكاملة (المفرد والمثنى والجمع والتمييز).
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

## الإعدادات المتاحة

- **الخط العربي (Arabic Font)**: اختيار الخط المفضل للواجهة.
- **حجم الخط (Font Size)**: ضبط نسبة حجم الخط العربي.
- **تفعيل اتجاه الواجهة الكامل (Enable Full RTL Layout)**: تفعيل أو إيقاف عكس اتجاه الواجهة (مع إمكانية تبديله سريعًا من صندوق أدوات Vencord).

---

## الترخيص (License)

هذا المشروع مرخص بموجب رخصة **GPL-3.0-or-later** متوافقة مع مشروع Vencord. راجع ملف [LICENSE](./LICENSE).
