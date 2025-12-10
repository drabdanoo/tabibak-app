# 📱 دليل نشر تطبيق Tabibok Health على Google Play Store

## 📋 **المتطلبات الأساسية**

قبل البدء، تأكد من توفر:
- ✅ حساب Google Play Console ($25 رسوم تسجيل لمرة واحدة)
- ✅ ملف APK أو AAB (سنقوم ببنائه)
- ✅ رابط سياسة الخصوصية: https://medconnect-2.web.app/app-privacy.html
- ✅ أيقونة التطبيق (512x512 بكسل)
- ✅ لقطات شاشة (على الأقل 2، حتى 8)
- ✅ معلومات التطبيق (الاسم، الوصف، إلخ)

---

## 🎯 **المراحل الرئيسية**

1. ⚙️ إعداد التطبيق للإنتاج
2. 🔨 بناء ملف AAB للإصدار
3. 📝 إنشاء قائمة المتجر
4. 🚀 رفع ونشر التطبيق
5. ✅ المراجعة والنشر

---

## المرحلة 1️⃣: إعداد التطبيق للإنتاج

### الخطوة 1.1: التحقق من app.json

تأكد من أن ملف `app.json` يحتوي على المعلومات الصحيحة:

```powershell
cd G:\tabibak-app\tabibak_react_native
code app.json
```

**يجب أن يحتوي على:**
```json
{
  "expo": {
    "name": "Tabibok Health",
    "slug": "tabibok-app",
    "version": "1.0.0",
    "android": {
      "package": "com.tabibok.health",
      "versionCode": 1,
      "targetSdkVersion": 35,
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "NOTIFICATIONS",
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ],
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#10b981"
      }
    }
  }
}
```

### الخطوة 1.2: إعداد ملف الإعلان (إذا لم يكن موجوداً)

إذا لم يكن لديك `eas.json`، قم بإنشائه:

```powershell
cd G:\tabibak-app\tabibak_react_native
```

**إنشاء ملف eas.json:**
```json
{
  "cli": {
    "version": ">= 5.4.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### الخطوة 1.3: التحقق من الأيقونات

تأكد من وجود:
- `assets/icon.png` (1024x1024)
- `assets/adaptive-icon.png` (1024x1024 مع foreground فقط)
- `assets/splash-icon.png` أو `splash.png`

---

## المرحلة 2️⃣: بناء ملف AAB

### الخطوة 2.1: تثبيت EAS CLI

```powershell
npm install -g eas-cli
```

### الخطوة 2.2: تسجيل الدخول إلى Expo

```powershell
eas login
```

### الخطوة 2.3: تكوين المشروع

```powershell
eas build:configure
```

### الخطوة 2.4: بناء AAB للإنتاج

**الطريقة 1: باستخدام EAS Build (موصى به)**

```powershell
cd G:\tabibak-app\tabibak_react_native
eas build --platform android --profile production
```

سيستغرق هذا 10-20 دقيقة. عند الانتهاء، ستحصل على رابط تنزيل لملف `.aab`.

**الطريقة 2: بناء محلي (إذا كان لديك Android Studio)**

```powershell
# إذا لم يتم التثبيت، قم بتثبيت prebuild
npx expo prebuild --platform android

# بناء AAB
cd android
./gradlew bundleRelease
```

الملف سيكون في: `android/app/build/outputs/bundle/release/app-release.aab`

### الخطوة 2.5: تنزيل ملف AAB

إذا استخدمت EAS Build:
1. افتح رابط البناء من المحطة الطرفية
2. قم بتنزيل ملف `.aab`
3. احفظه في مكان آمن

---

## المرحلة 3️⃣: إعداد Google Play Console

### الخطوة 3.1: إنشاء حساب المطور

1. اذهب إلى: https://play.google.com/console
2. انقر على "Create account"
3. ادفع رسوم التسجيل لمرة واحدة ($25)
4. أكمل ملف تعريف المطور

### الخطوة 3.2: إنشاء تطبيق جديد

1. في Play Console، انقر على **"Create app"**
2. املأ التفاصيل:
   - **App name:** Tabibok Health
   - **Default language:** Arabic (العربية)
   - **App or game:** App
   - **Free or paid:** Free

3. أعلن عن السياسات:
   - ✅ أوافق على سياسة البرنامج للمطورين
   - ✅ أوافق على قوانين تصدير الولايات المتحدة

4. انقر على **"Create app"**

---

## المرحلة 4️⃣: إكمال قائمة المتجر

### الخطوة 4.1: تفاصيل التطبيق الرئيسية

اذهب إلى **"Main store listing"** وأكمل:

#### **1. وصف التطبيق**

**وصف قصير (80 حرفاً كحد أقصى):**
```
احجز مواعيد طبية وأدر سجلاتك الصحية بأمان
```

**وصف كامل:**
```
🏥 Tabibok Health - منصة الحجز الطبي الشاملة

احجز مواعيد مع أطباء معتمدين، أدر سجلاتك الطبية، وابق على اتصال مع مقدمي الرعاية الصحية - كل ذلك في تطبيق واحد.

⚠️ إخلاء مسؤولية طبي
هذا التطبيق ليس جهازاً طبياً ولا يقوم بتشخيص أو علاج أو شفاء أو منع أي حالة طبية. Tabibok Health هي منصة حجز واتصال لخدمات الرعاية الصحية. استشر دائماً متخصصي الرعاية الصحية المؤهلين.

المميزات:
✓ احجز مواعيد مع أطباء معتمدين
✓ اعرض الأوقات المتاحة في الوقت الفعلي
✓ أدر تاريخك الطبي
✓ استقبل تذكيرات المواعيد
✓ رسائل آمنة مع مقدمي الرعاية الصحية
✓ ارفع وخزن المستندات الطبية
✓ تتبع الوصفات الطبية والأدوية

للمرضى:
• ابحث عن الأطباء حسب التخصص
• اعرض ملفات تعريف الأطباء وتوفرهم
• احجز وأدر المواعيد
• الوصول إلى سجلاتك الطبية في أي وقت
• استقبل ملاحظات الزيارة والوصفات الطبية

للأطباء:
• أدر جدولك الزمني
• اعرض معلومات المرضى
• أكمل ملاحظات الزيارة
• صف الأدوية
• تتبع عائدات العيادة

الخصوصية والأمان:
بياناتك الصحية مشفرة وآمنة. نلتزم بمعايير حماية بيانات الرعاية الصحية. اقرأ سياسة الخصوصية الخاصة بنا على: https://medconnect-2.web.app/app-privacy.html

الدعم:
privacy@tabibakcare.com
```

#### **2. أيقونة التطبيق**
- قم برفع أيقونة 512x512 بكسل بصيغة PNG
- يجب أن تكون شفافة الخلفية
- تمثل علامتك التجارية (رمز طبي/صحي)

#### **3. الرسومات المميزة**
- 1024x500 بكسل PNG أو JPEG
- يمكن أن تحتوي على نص وشعار
- مثال: شعار التطبيق + "احجز مواعيدك الطبية بسهولة"

#### **4. لقطات الشاشة**

**الهاتف (مطلوب - 2 على الأقل، حتى 8):**
- دقة 16:9 أو 9:16
- الحد الأدنى 320 بكسل
- الحد الأقصى 3840 بكسل
- PNG أو JPEG

**أمثلة على ما يجب التقاطه:**
1. شاشة تسجيل الدخول
2. قائمة الأطباء/التخصصات
3. حجز موعد
4. السجلات الطبية
5. الإشعارات/التذكيرات

**كيفية أخذ لقطات الشاشة:**
```powershell
# شغل التطبيق في المحاكي
npx expo start --android

# في المحاكي، اضغط Ctrl+S أو استخدم أدوات Android Studio
# أو استخدم هاتفك الحقيقي وخذ screenshots
```

#### **5. الفئة**
- **Application type:** Application
- **Category:** Medical
- أو اختر "Health & Fitness"

#### **6. معلومات الاتصال**
- **Email:** privacy@tabibakcare.com
- **Phone:** (اختياري)
- **Website:** https://www.tabibakcare.com

#### **7. سياسة الخصوصية**
**URL (مطلوب):**
```
https://medconnect-2.web.app/app-privacy.html
```

### الخطوة 4.2: أمان البيانات

اذهب إلى **"Data safety"** وأكمل النموذج:

#### **هل يجمع التطبيق بيانات؟**
✅ نعم

#### **البيانات المجمعة:**

**المعلومات الشخصية:**
- ✅ الاسم
- ✅ البريد الإلكتروني
- ✅ رقم الهاتف
- ✅ تاريخ الميلاد
- Purpose: Account creation, Authentication
- Data encrypted in transit: ✅ Yes
- Can users request deletion: ✅ Yes

**المعلومات الصحية:**
- ✅ التاريخ الطبي
- ✅ الأدوية
- ✅ الحساسية
- ✅ الحالات الصحية
- Purpose: Medical records management
- Data encrypted in transit: ✅ Yes
- Data encrypted at rest: ✅ Yes
- Can users request deletion: ✅ Yes (with legal retention)

**الموقع (تقريبي):**
- ✅ موقع تقريبي
- Purpose: Find nearby clinics
- Optional: ✅ Yes
- Can users request deletion: ✅ Yes

**الصور والفيديوهات:**
- ✅ الصور
- Purpose: Medical documents
- Can users request deletion: ✅ Yes

**الهوية:**
- ✅ معرف المستخدم
- Purpose: Account management
- Can users request deletion: ✅ Yes

#### **هل تشارك البيانات مع أطراف ثالثة؟**
✅ نعم

**الأطراف الثالثة:**
- Google Firebase (استضافة البيانات والمصادقة)
- مقدمو الرعاية الصحية (لأغراض العلاج)

**Note:** لا نبيع البيانات الشخصية

### الخطوة 4.3: تصنيف المحتوى

اذهب إلى **"Content rating"**:

1. انقر على **"Start questionnaire"**
2. أجب على الأسئلة بصدق:
   - هل يحتوي التطبيق على عنف؟ ❌ لا
   - هل يحتوي على محتوى جنسي؟ ❌ لا
   - هل يحتوي على محتوى محظور؟ ❌ لا
   - هل يحتوي على محتوى مخيف؟ ❌ لا
   - هل يحتوي على لغة بذيئة؟ ❌ لا
   - هل يتفاعل المستخدمون؟ ✅ نعم (محادثات بين مرضى وأطباء)
   - هل يشارك المستخدمون معلومات؟ ✅ نعم (معلومات طبية)
   - هل يمكن للمستخدمين شراء محتوى؟ ❌ لا (أو نعم إذا كان لديك مدفوعات)
3. احفظ وأرسل

### الخطوة 4.4: الجمهور المستهدف

اذهب إلى **"Target audience"**:

1. **Age groups:** 
   - ✅ Ages 18+
   - (أو Ages 13-17 بموافقة الوالدين)
2. هل التطبيق يستهدف الأطفال؟ ❌ لا

### الخطوة 4.5: إعلان مالي (Financial Features Declaration)

**موعد نهائي: 30 أكتوبر 2025**

اذهب إلى **"Financial features declaration"**:

**إذا لم يكن لديك مدفوعات:**
- ❌ لا، تطبيقي لا يحتوي على ميزات مالية

**إذا كان لديك مدفوعات:**
- ✅ نعم، التطبيق يحتوي على:
  - ☐ Cryptocurrency
  - ☐ NFTs
  - ☐ Real money gambling
  - ☐ Loans
  - أو: ☑ Other financial features

---

## المرحلة 5️⃣: رفع التطبيق

### الخطوة 5.1: إنشاء إصدار

1. اذهب إلى **"Production"** في القائمة الجانبية
2. انقر على **"Create new release"**

### الخطوة 5.2: رفع ملف AAB

1. انقر على **"Upload"**
2. اختر ملف `.aab` الذي قمت ببنائه
3. انتظر حتى يتم التحميل والمعالجة

### الخطوة 5.3: ملاحظات الإصدار

أضف ملاحظات الإصدار (بالعربية والإنجليزية):

**العربية:**
```
الإصدار الأول من Tabibok Health! 🎉

✨ المميزات:
• احجز مواعيد طبية بسهولة
• أدر سجلاتك الصحية
• تواصل مع الأطباء بأمان
• استقبل تذكيرات المواعيد
• تتبع الوصفات الطبية

🔒 خصوصيتك وأمانك أولويتنا
📧 الدعم: privacy@tabibakcare.com
```

**English:**
```
First release of Tabibok Health! 🎉

✨ Features:
• Book medical appointments easily
• Manage your health records
• Communicate securely with doctors
• Receive appointment reminders
• Track prescriptions

🔒 Your privacy and security is our priority
📧 Support: privacy@tabibakcare.com
```

### الخطوة 5.4: حفظ ومراجعة

1. انقر على **"Save"**
2. راجع جميع المعلومات
3. تأكد من:
   - ✅ سياسة الخصوصية مضافة
   - ✅ لقطات الشاشة محملة
   - ✅ الوصف كامل مع إخلاء المسؤولية الطبي
   - ✅ Data safety form مكتمل
   - ✅ تصنيف المحتوى مكتمل
   - ✅ الجمهور المستهدف محدد

---

## المرحلة 6️⃣: النشر

### الخطوة 6.1: إرسال للمراجعة

1. عد إلى صفحة **"Production release"**
2. انقر على **"Review release"**
3. راجع كل شيء مرة أخيرة
4. انقر على **"Start rollout to Production"**

### الخطوة 6.2: وقت المراجعة

- **الوقت المتوقع:** 1-7 أيام (عادة 2-3 أيام)
- **ستتلقى بريداً إلكترونياً** عند:
  - بدء المراجعة
  - الموافقة على التطبيق
  - رفض التطبيق (مع سبب الرفض)

### الخطوة 6.3: بعد الموافقة

عندما تتم الموافقة:
- سيكون التطبيق مباشراً على Google Play خلال بضع ساعات
- يمكن للمستخدمين البحث عن "Tabibok Health" وتنزيله
- ستحصل على رابط Play Store: `https://play.google.com/store/apps/details?id=com.tabibok.health`

---

## 🔧 نصائح مهمة

### ✅ افعل:
- اختبر التطبيق جيداً قبل النشر
- استخدم أيقونات وصور عالية الجودة
- اكتب وصفاً واضحاً مع إخلاء المسؤولية الطبي
- أضف لقطات شاشة توضح الميزات الرئيسية
- رد على مراجعات المستخدمين بسرعة

### ❌ لا تفعل:
- لا تستخدم صوراً محمية بحقوق النشر
- لا تدعي أن التطبيق يشخص أو يعالج الأمراض
- لا تطلب أذونات غير ضرورية
- لا تجمع بيانات أكثر مما هو معلن
- لا تتجاهل رسائل الرفض من Google

---

## 🆘 حل المشاكل الشائعة

### مشكلة: "App Bundle not signed"

**الحل:**
```powershell
# إذا كنت تبني محلياً، قم بتوقيع AAB:
cd android
./gradlew bundleRelease

# أو استخدم EAS Build الذي يوقع تلقائياً
eas build --platform android --profile production
```

### مشكلة: "Missing privacy policy"

**الحل:**
أضف رابط سياسة الخصوصية:
```
https://medconnect-2.web.app/app-privacy.html
```

### مشكلة: "Medical app requires disclaimer"

**الحل:**
أضف في أول الوصف:
```
⚠️ إخلاء مسؤولية طبي
هذا التطبيق ليس جهازاً طبياً ولا يقوم بتشخيص أو علاج...
```

### مشكلة: "Screenshots required"

**الحل:**
قم بأخذ لقطات شاشة:
```powershell
npx expo start --android
# خذ screenshots من المحاكي أو الجهاز الحقيقي
```

### مشكلة: "Target SDK not met"

**الحل:**
في `app.json`:
```json
"android": {
  "targetSdkVersion": 35
}
```

---

## 📧 دعم وموارد

### موارد رسمية:
- **Play Console:** https://play.google.com/console
- **سياسات المطورين:** https://play.google.com/about/developer-content-policy/
- **دليل النشر:** https://developer.android.com/distribute
- **دعم Google Play:** https://support.google.com/googleplay/android-developer

### للمساعدة الفنية:
- **Email:** privacy@tabibakcare.com
- **سياسة الخصوصية:** https://medconnect-2.web.app/app-privacy.html

---

## ✅ قائمة مراجعة نهائية

قبل الإرسال، تحقق من:

- [ ] ملف AAB مبني واختباره
- [ ] أيقونة التطبيق (512x512)
- [ ] لقطات شاشة (2-8 صور)
- [ ] رسومات مميزة (1024x500)
- [ ] وصف كامل مع إخلاء المسؤولية الطبي
- [ ] رابط سياسة الخصوصية مضاف
- [ ] نموذج أمان البيانات مكتمل
- [ ] تصنيف المحتوى مكتمل
- [ ] الجمهور المستهدف محدد
- [ ] Financial Features Declaration مكتمل (موعد نهائي: 30 أكتوبر)
- [ ] معلومات الاتصال صحيحة
- [ ] ملاحظات الإصدار بالعربية والإنجليزية

---

## 🎉 تهانينا!

عند اكتمال جميع الخطوات والموافقة على التطبيق، سيكون Tabibok Health متاحاً على Google Play Store! 🚀

**الخطوات التالية:**
1. شارك رابط Play Store مع المستخدمين
2. راقب التقييمات والمراجعات
3. رد على ملاحظات المستخدمين
4. حدّث التطبيق بانتظام

**حظاً موفقاً! 🍀**
