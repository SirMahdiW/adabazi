# گزارش مهندسی معکوس (Reverse Engineering) اپلیکیشن «ادابازی» (Adabazi)

> **دامنه کار:** تحلیل ایستای (Static Analysis) کامل فایل `base.apk`.
> هیچ درخواستی به سرورهای واقعی ارسال نشد و هیچ حمله‌ای علیه زیرساخت توسعه‌دهنده انجام نشد.
> تمام ابزارها روی ماشین محلی اجرا شدند (jadx 1.5.1، apktool 2.11.1، JDK 21، Python 3.13).

---

## ۱. شناسنامه اپلیکیشن

| مورد | مقدار |
|---|---|
| نام بسته (Package) | `com.karvant.adabazi` |
| نام اپ | **Adabazi** (ادابازی) — بازی گروهی پانتومیم/ادبیات |
| versionName / versionCode | **4.1.2 / 74** |
| minSdk / targetSdk / compileSdk | 24 (Android 7) / **36** / 36 |
| Flavor / Build Type | `CafeBazaar` / `release` (`DEBUG=false`) |
| ابزار ساخت | Android Gradle Plugin **8.13.0** |
| revision گیت | `211dd44f69fb50837ea4c7114b9341f8c5caa57a` |
| حجم فایل | 21,176,366 بایت (~20.2 MB) |
| ساختار | 4 فایل DEX، 9030 کلاس، **14,156 فایل جاوا** decompile شد |
| امضا | **v2 + v3** (بدون v1) — بلوک امضای APK معتبر است |
| SO بومی | فقط `libpl_droidsonroids_gif.so`، `libsentry.so`, `libsentry-android.so` |

**پشته فنی:** Kotlin/Java، معماری MVVM (ViewModel + LiveData)، Room (SQLite)، Retrofit2 + Gson، RxJava2، Coroutines، Fastjson + Moshi + OkHttp، Glide، Lottie، DataBinding/ViewBinding، Firebase (Analytics/Crashlytics/FCM)، Sentry.

**کتابخانه‌های تبلیغاتی:** TapSell (mediation + legacy + tv-ads)، Adivery، AdMob/Google Ads، Yektanet، Huawei HMS Ads.

---

## ۲. ساختار عملکردی (از روی کد)

### اکتیویتی‌ها
| کلاس | نقش |
|---|---|
| `ui.splash.SplashScreenActivity` | لانچر (تنها کامپوننت `exported=true`)، ورود مهمان، بررسی بروزرسانی |
| `ui.home.HomeActivity` | صفحه اصلی، بنر، دونیت |
| `ui.game.PlayActivity` | مسیر بازی (دسته‌بندی، تیم‌ها، تاریخچه) |
| `ui.game.play.adabazi.AdbaziPlayFragment` | حالت «ادبیات/پانتومیم» |
| `ui.game.play.boom.BoomPlayFragment` | حالت «بوم» |
| `ui.news.NewsActivity` / `ui.omen.OmenActivity` | اخبار / فال روزانه |
| `ui.settings.SettingsActivity` | تنظیمات، پشتیبانی، شبکه‌های اجتماعی |
| `ui.payment.*` | پرداخت: شارژ مستقیم، بسته اینترنت، استعلام و پرداخت قبض |

### دیتابیس محلی (Room + فایل `assets/database1.db`)
| جدول | تعداد رکورد | وضعیت |
|---|---|---|
| `content_adabazi` | **16,305** | رمزنگاری‌شده AES |
| `content_boom` | **1,029** | رمزنگاری‌شده AES |
| `content_song` | **50** | رمزنگاری‌شده AES |
| `category` | 31 | ساده |
| `banner` | 1 | ساده |
| جدول‌های `history`, `teams`, `news`, `omen`, `internet` | در دیتابیس اجرا ساخته می‌شوند | — |

۱۸ دسته محتوا با شناسه‌های 70 تا 86 (عمومی، اشیاء، خوراکی، تکنولوژی، شغل، جانوران، ورزشی، اماکن، فوتبال، کارتون، کتاب، مشاهیر، موسیقی، شهر و کشور، فیلم، کودکان، سلبریتی، ترانه).

---

## ۳. کانال‌های ارتباطی با بیرون (۳ مسیر اصلی)

### ۳.۱ پروتکل سوکت TCP خام — `karvant.ir:5485`
فایل `utils/TransportDriver.java`:

- `Socket.connect(new InetSocketAddress("karvant.ir", 5485))` با timeout 5 ثانیه
- فرمت پیام: **پیشوند 10 رقمی (طول payload) + بدنه JSON** (پروتکل اختصاصی، بدون TLS)
- ارسال: `JSON.toJSONString(DataClass)` — بدون امضای دیجیتال و بدون توکن احراز هویت
- دریافت: خواندن 10 بایت طول، سپس payload با سقف 10MB، سپس `JSON.parseObject`

**کدهای درخواست (RequestCode):**
| کد | عملکرد | داده ارسالی |
|---|---|---|
| `21` | `REQUEST_JOIN_USER` (ورود مهمان) | `firebaseID` (توکن FCM)، `appVersion`، `apiVersion`، `marketName`، `languageCode` |
| `502` | `REQUEST_CHECK_FOR_UPDATE` (همگام‌سازی) | `uuid` کاربر، تعداد محتوای هر سه جدول |
| `175` | `REQUEST_GET_OMEN_DATA` (فال) | — |
| `65` | `REQUEST_SET_RATE` (امتیازدهی) | — |

**پاسخ سرور شامل این فیلدهاست (`model/DataClass.java`):**
`admob_key/admob_banner/admob_interstitial/admob_reward/admob_native`، `bannerList`، `bannerClickUrl`، `newsList`، `omenList`، `updateData`، `donateLink/donateTitle/donateDes`، `faqAddress`، `termsAddress`، `homeTitle`، `splashLogo/Color/Slogan`، `coinReward`، `paymentServiceState`، `checkWinner`، `limitBy`، `totalAdabaziContent/Boom/Song`، `userData(uuid, username, coin)` و ...

### ۳.۲ سرویس پرداخت — `https://inax.ir/webservice.php`
`data/remote/ApiService.java` (Retrofit + FormUrlEncoded + POST):
- `invoice` → شارژ مستقیم / خرید بسته اینترنت / پرداخت قبض
- `get_products` → لیست بسته‌های اینترنت
- `check_bill` → استعلام قبض
- callback بازگشت: `http://ada-bazi.ir/payment/invoice=<order_id>` (**HTTP روشن**)
- لینک پرداخت نهایی: `https://inax.ir/pay.php?tid=<trans_id>` در مرورگر باز می‌شود

### ۳.۳ سرویس‌های گوگل/第三方
- Firebase: project `adabazi-c61da`، sender id `779268291262`
- Sentry: `o490675.ingest.us.sentry.io/4507227598684160` + `sentry.yektanet.tech//52` + `sentry.pegah.tech`
- TapSell gateway: `https://gateway-tapsell.pegah.tech/v2/` و `https://api.tapsell.ir/v2/`
- Adivery: `fetch.adivery.com`, `events.adivery.com`, `cf-fetch.adivery.com`
- دامنه‌های باز: `karvant.ir`، `ada-bazi.ir`، `daramet.com/Adabazi` (دونیت)، `t.me/adabazi_admin`، `instagram.com/ada.bazi`

---

## ۴. اطلاعات محرمانه hard-code شده در کلاینت

| نوع | مقدار | محل |
|---|---|---|
| **نام کاربری درگاه** | `81f558c186c7a9489badd280632e3110` | `Values.PAYMENT_USER` و `DatabaseValue.VALUE_REQUEST_USERNAME` |
| **رمز عبور درگاه** | `PApqztNDR5` | `Values.PAYMENT_PASSWORD` و `DatabaseValue.VALUE_REQUEST_PASSWORD` |
| شرکت/Callback | `Adabazi` | `Values.PAYMENT_COMPANY` |
| callback بازگشت | `http://ada-bazi.ir/payment/invoice=` | `Values.PAYMENT_CALLBACK` |
| **کلید رمزنگاری محتوا** | `iFvnbNUToyltmYFvnKVHIMpj905219Bg` (SHA-1 → 16 بایت → AES) | `Crypt.secret` |
| Firebase API Key | `AIzaSyD1R_6lvCs0pW0VG6sTmOOGW8RgF7Lel2I` | `res/values` |
| Firebase App ID | `1:779268291262:android:3fa908f560e24b91403cef` | `res/values` |
| TapSell APPLICATION_KEY | `6911b30b5aadb977de668b2a` | manifest meta-data |
| TapSell unitها | banner `6911b449...`, interstitial `6911b3fa...`, rewarded `6911b37c...` | `BuildConfig` |
| Adivery کلیدها | `831e1ef7-...` + 3 کلید banner/interstitial/rewarded | `BuildConfig` |
| AdMob | `ca-app-pub-8552844735930848~7884457203` + 3 unit | `BuildConfig` |
| پورت سرور اختصاصی | `5485` | `BuildConfig.ServerPort` |

---

## ۵. رمزنگاری محتوا و استخراج کامل دیتابیس

الگوریسم (`utils/Crypt.java`):
```
key = SHA-1("iFvnbNUToyltmYFvnKVHIMpj905219Bg")[0:16]
mode = AES/ECB/PKCS5Padding
output = Base64(cipher(text))
```

چون کلید در خود اپ هاردکد شده، **کل محتوای بازی قابل بازیابی است**. با پیاده‌سازی AES-128 روی محلی (بدون وابستگی خارجی) و اعتبارسنجی با بردار آزمون NIST، دیتابیس کامل بازگشایی شد:

| خروجی | تعداد |
|---|---|
| `content_adabazi_decrypted.csv` | 16,305 کلمه/عبارت فارسی |
| `content_boom_decrypted.csv` | 1,029 |
| `content_song_decrypted.csv` | 50 (متن + خواننده) |
| `category.csv` | 31 |
| `banner.csv` | 1 |

نمونه رکوردهای بازگشایی‌شده:
- ادبیات: `طلا`، `آرام`، `دراز`، `سریع`، `خشن`، `خوش صدا`، `کچل` …
- بوم: `اسم پسر با الف`، `اسم پسر با ب` …
- ترانه: «سردی نگاهو بشکن…» — سون | «کمر باریک من…» — فرامرز آصف …

---

## ۶. یافته‌های امنیتی

### 🔴 بالا

**F-1 — اعتبارنامه درگاه پرداخت در کلاینت hard-code شده**
username/password سرویس `webservice.php` داخل APK به صورت متنی قرار دارد. هر شخصی می‌تواند مستقیماً به API درگاه با این هویت تماس بگیرد (ایجاد فاکتور، خواندن محصولات). تنها راه‌حل، محدود کردن سمت سرور (IP/مبدأ اپ، سقف تراکنش، امضا) است.

**F-2 — پروتکل سوکت `karvant.ir:5485` بدون TLS و بدون احراز هویت**
- ترافیک JSON کاملاً روشن (بدون رمزنگاری) → در شبکه Wi-Fi عمومی قابل رهگیری/جایگزینی است.
- سرور هیچ امضایی از کلاینت نمی‌گیرد → هر کلاینتی می‌تواند «کلاینت واقعی» را شبیه‌سازی کند.
- از سمت دیگر، **پاسخ سرور قابل دستکاری است** و کلاینت بدون بررسی آن را می‌پذیرد. با MITM می‌توان:
  - کلیدها/یونیت‌های AdMob را عوض کرد (تحریف درآمد تبلیغات)
  - `bannerClickUrl` و `donateLink` و `faqAddress` و `termsAddress` را به هر URL دلخواهی تغییر داد (ریدایرکت کاربران)
  - `updateData` را جعل کرد (دکمه «بروزرسانی» به فایل دلخواه)
  - داده‌های `userData` (uuid/coin) را تغییر داد

**F-3 — کلید رمزنگاری محتوا hard-code شده → کل انحصار محتوا از بین رفته**
کل ۱۷,۳۸۴ رکورد محتوا با همین یک کلید قابل استخراج است (انجام شد).

### 🟠 متوسط

**F-4 — کنترل از راه دور از طریق Push (FCM) بدون اعتبارسنجی**
`CloudMessagingService` بر اساس فیلدهای payload پیام، Intent می‌سازد:
- `action_* = url` → باز کردن **هر URL دلخواه** (`Intent.ACTION_VIEW`)
- `action_* = dial` → شماره‌گیری شماره دلخواه
- `action_* = sms` → باز کردن ارسال پیامک با متن و گیرنده کنترل‌شده از سمت سرور
- `action_* = vote/page` → انتقال به مارکت‌ها
- دانلود بیرونی `notification_large_icon` و `big_picture_url` با `URL.openConnection()` بدون محدودیت دامنه

اگر دسترسی به Firebase Cloud Messaging پنل توسعه‌دهنده (یا سرور ارسال پیام) به هر دلیلی لو برود، مهاجم می‌تواند برای همه کاربران اعلان با دکمه‌ای بسازد که هر URL را باز می‌کند.

**F-5 — callback پرداخت روی HTTP (بدون TLS)**
`http://ada-bazi.ir/payment/invoice=<id>` — علاوه بر این، دامنه `ada-bazi.ir` در `network_security_config.xml` هم تعریف نشده (فقط `karvant.ir` allowlist شده). هدر callback معمولاً سمت سرور درگاه ارسال می‌شود، اما اگر کلاینت آن را دنبال کند، در معرض MITM است.

**F-6 — `android:allowBackup="true"` بدون محدودیت**
با وجود `dataExtractionRules`/`fullBackupContent` تعریف‌نشده، backup کامل داده‌های اپ (شامل `SharedPreferences` با `uuid`، `username`، `userCoin` و دیتابیس Room) روی دستگاه‌های قدیمی/روت قابل استخراج است.

**F-7 — نبود هرگونه محافظت از یکپارچگی (Anti-Tamper)**
هیچ اثری از Play Integrity، SafetyNet، بررسی امضای خود، `FLAG_DEBUGGABLE`، RootBeer یا مبارزه با ریپکیج پیدا نشد. چون:
- منطق بازی، امتیازها و تاریخچه کاملاً **لوکال** نگهداری می‌شود (Room + `SharedPreferences`)،
- بدون `minifyEnabled` (نام کلاس‌ها، `BuildConfig`، `Values` کاملاً خوانا هستند)،
امکان ساخت نسخه هک‌شده/مود بسیار ساده است.
(نکته: فیلد `coin` از سرور می‌آید و در `SharedPreferences` ذخیره می‌شود، اما متد `getUserCoin()` در هیچ‌جای کد اپ فراخوانی نشده — یعنی در این نسخه عملاً بلااستفاده است.)

**F-8 — مجوز `READ_PHONE_STATE` بدون استفاده**
در کد اپلیکیشن هیچ فراخوانی `TelephonyManager/getDeviceId/getImei` وجود ندارد (فقط کتابخانه‌های تبلیغاتی ممکن است از آن استفاده کنند). حذف آن توصیه می‌شود.

### 🟢 پایین

**F-9 — استفاده از AES/ECB** (به‌جای CBC/GCM) — الگوی تکراری متن در خروجی قابل مشاهده است.
**F-10 — بدون Certificate Pinning** برای `inax.ir` و `karvant.ir`.
**F-11 — احتمال ثبت داده حساس در لاگ**: `SentryLogcatAdapter.e("hello1", ...)` عنوان/متن اعلان‌ها را لاگ می‌کند؛ `Crypt` هم متنِ در حال رمزنگاری را در پیام خطا می‌نویسد (`String: ... Error: ...`).
**F-12 — اطلاعات build در APK**: `META-INF/version-control-info.textproto` شامل revision گیت و `app-metadata.properties` شامل نسخه AGP.
**F-13 — `network_security_config` ناقص**: فقط `karvant.ir` برای cleartext مجاز شده، در حالی که `ada-bazi.ir` هم استفاده می‌شود (یا باید اضافه شود یا اجرا به HTTPS).
**F-14 — ایراد متنی در خطاها**: `"خظا، لطفا با پشتیبانی ادابازی تماس بگیرید!"` (غلط املایی «خطا»).
**F-15 — `ad-services-config` با `allowAllToAccess="true"`** — دسترسی کامل از سمت همه به اтриبیوشن تبلیغاتی.

**F-16 — WebView با `addJavascriptInterface` در SDK های تبلیغاتی**
کد خودِ اپ هیچ WebView ندارد، اما کتابخانه‌های تبلیغاتی از آن استفاده می‌کنند:
- `ir.tapsell.sdk.bannerads` → `addJavascriptInterface(..., "JSInterface")` با `setJavaScriptEnabled(true)`
- `ir.tapsell.sdk.advertiser` و `ir.tapsell.mediation.billboard` → همین الگو
- `com.yektanet.base` → `addJavascriptInterface(dVar, "Environment")`
- `com.google.ads.interactivemedia` (Google IMA)

محتوای این WebView ها از سرور تبلیغات دانلود می‌شود؛ هر گونه تزریق محتوا در زنجیره تبلیغات می‌تواند به پل JavaScript متصل به کد جاوا دسترسی داشته باشد. (ریسک متعلق به SDKهاست، نه کد شما — اما نسخه آن‌ها را به‌روز نگه دارید)

### ✅ نکات مثبت
- **کد خودِ اپ هیچ WebView ندارد** → ریسک اجرای JS مهاجم از مسیر اپ (بنرها، اخبار، لینک‌ها) وجود ندارد؛ لینک‌ها با `Intent.ACTION_VIEW` در مرورگر/مارکت باز می‌شوند.
- **بدون بارگذاری کد پویا** (هیچ `DexClassLoader`/`PathClassLoader`/`ProcessBuilder`/`Runtime.exec` در کد اپ نیست).
- **Room از کوئری پارامتری استفاده می‌کند** → SQL Injection مشاهده نشد.
- **فقط یک اکتیویتی exported** (لانچر)؛ بقیه غیرفعال‌اند.
- دسترسی خطرناک ندارد: نه READ_SMS، نه READ_CONTACTS (انتخاب مخاطب از طریق `Intent.ACTION_PICK` است)، نه دسترسی فایل خارجی. هیچ `FileProvider` هم در مانیفست ثبت نشده (فایل `image_share_filepaths.xml` وجود دارد اما provider ای برای آن تعریف نشده)، یعنی مسیر فایل افشاشده‌ای در دسترس اپ‌های دیگر نیست.
- امضای APK از نوع v2/v3 است.
- کلیدهای تبلیغاتی و پیکربندی‌های زیادی **از سرور قابل تغییر است** (بدون نیاز به انتشار آپدیت) — از نظر مهندسی خوب، اگرچه همان‌طور که در F-2 آمد ریسک امنیتی هم دارد.

---

## ۷. پیشنهادهای اصلاحی (اولویت‌بندی‌شده)

1. **انتقال اعتبارنامه درگاه به سرور:** کلاینت فقط `order_id` و مبلغ را بفرستد؛ ساخت فاکتور و امضای درخواست در backend خودتان انجام شود. (F-1)
2. **جایگزینی سوکت 5485 با HTTPS + امضای HMAC:** دست‌کم TLS و یک توکن نشست با امضای درخواست. پاسخ سرور را نیز امضا کنید تا MITM بی‌اثر شود. (F-2)
3. **خنثی‌سازی FCM:** محدود کردن scheme های مجاز در `action_*_url` (فقط `https` و دامنه‌های خودتان)، حذف شاخه `dial`/`sms` یا محدودکردن آن، و عدم اجرای آن‌ها بدون تأیید کاربر. (F-4)
4. **`android:allowBackup="false"`** یا تعریف `dataExtractionRules` با حذف SharedPreferences و دیتابیس. (F-6)
5. **حذف `READ_PHONE_STATE`** و بازبینی مجوزهای SDK های تبلیغاتی. (F-8)
6. **فعال‌سازی R8/minify + افزودن Play Integrity API** برای جلوگیری از ریپکیج و مود. (F-7)
7. **انتقال callback به HTTPS** و افزودن `ada-bazi.ir` به network security config یا حذف کامل HTTP. (F-5, F-13)
8. **Certificate Pinning** برای `inax.ir` (با پلن B). (F-10)
9. **پاک‌سازی لاگ‌ها:** حذف `SentryLogcatAdapter` در ریلیز و عدم قرار دادن متن ورودی در پیام خطا. (F-11)
10. **در مورد محتوا:** اگر انحصار محتوا اهمیت دارد، رمزنگاری کلاینت‌محور ارزشی ندارد؛ محتوا را سمت سرور نگه دارید و به صورت جریانی (stream) و امضاشده ارسال کنید. (F-3)
11. **به‌روز نگه‌داشتن SDK های تبلیغاتی** (TapSell، Yektanet، IMA) که از `addJavascriptInterface` در WebView استفاده می‌کنند. (F-16)

---

## ۸. خروجی‌های تولیدشده

مسیر: `C:\Users\SirMW\Desktop\app پانتومیم\`

| فایل | توضیح |
|---|---|
| `REPORT.md` | همین گزارش |
| `content_adabazi_decrypted.csv` | 16,305 محتوای بازی ادبیات (بازگشایی‌شده) |
| `content_boom_decrypted.csv` | 1,029 محتوای حالت بوم |
| `content_song_decrypted.csv` | 50 متن ترانه + خواننده |
| `category.csv` | 31 دسته‌بندی |
| `banner.csv` | رکورد بنر |

مسیر کار تحلیل (کد decompile‌شده و اسکریپت‌ها):
`C:\Users\SirMW\AppData\Local\Temp\opencode\apk-re\`
- `src\sources\` — کد جاوا/کوتلین خوانا (کد خودِ اپ مینیفای/obfuscate نشده؛ برخی SDK های تبلیغاتی مثل `com.yektanet.base.r1` و `ir.tapsell.sdk.a` مینیفای شده‌اند)
- `apktool_out\AndroidManifest.xml` — مانیفست متنی
- `raw\` — محتوای استخراج‌شده APK
- `decrypt_db.py`, `export_db.py`, `aes.py` — اسکریپت بازگشایی محتوا
