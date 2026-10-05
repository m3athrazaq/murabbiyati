# مربّيتي

مؤقت رعاية الطفل: تغيير، رضاعة، نوم، وأحداث أخرى. يعمل دون إنترنت، ويتبادل السجل مع الحضانة بملف CSV. الواجهة متاحة بـ 51 لغة، وتتبع لغة الهاتف تلقائيًا، ويمكن تغييرها من الإعدادات.

## التحميل

| الهاتف | الملف (آخر نسخة دائمًا) | التثبيت |
|---|---|---|
| أندرويد | [murabbiyati.apk](https://github.com/m3athrazaq/murabbiyati/releases/latest/download/murabbiyati.apk) | افتح الرابط على الهاتف، ثم افتح الملف بعد تنزيله، واسمح بالتثبيت من هذا المصدر عند السؤال. |
| آيفون | [murabbiyati.ipa](https://github.com/m3athrazaq/murabbiyati/releases/latest/download/murabbiyati.ipa) | عبر SideStore أو Sideloadly بحساب Apple عادي، ويحتاج تجديدًا كل 7 أيام. |

النسخ الجديدة تُثبَّت فوق القديمة، وتبقى البيانات كما هي.

## محتوى المستودع

- `index.html` والملفات المجاورة: التطبيق نفسه، ويعمل كما هو من GitHub Pages.
- `native/`: يحوّل الملفات نفسها إلى تطبيق آيفون (`native/ios`) وتطبيق أندرويد (`native/android`).
- `native/signing/`: مفتاح توقيع نسخة أندرويد. لا تحذفه، فالتحديثات لا تُثبَّت إلا بالمفتاح نفسه.
- `.github/workflows/apps.yml`: كل تعديل يُرفع يبني ملفَي IPA وAPK على GitHub Actions، وينشرهما معًا في Releases.
- `.github/workflows/*-smoke.yml`: اختبار تلقائي للتطبيق على محاكي آيفون ومحاكي أندرويد.
