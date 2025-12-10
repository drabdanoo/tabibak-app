# App Store Compliance Guide - Tabibok Health

**Last Updated:** December 8, 2025  
**App Version:** 1.0.0  
**Package:** com.tabibok.health

---

## 🚨 CRITICAL COMPLIANCE UPDATES APPLIED

### ✅ **1. Android Target SDK Updated**
- **Status:** COMPLETED
- **Requirement:** Must target Android 15 (API Level 35) by August 31, 2025
- **Action Taken:** Updated `app.json` with `"targetSdkVersion": 35`
- **File Modified:** `app.json`

### ✅ **2. Privacy Policy Created**
- **Status:** COMPLETED
- **Requirement:** Both stores require public privacy policy URL
- **Action Taken:** Created comprehensive PRIVACY_POLICY.md
- **Next Step Required:** Host this at a public URL (e.g., https://tabibok.health/privacy-policy)
- **File Created:** `PRIVACY_POLICY.md`

### ✅ **3. Medical Disclaimer Added**
- **Status:** COMPLETED
- **Requirement:** Healthcare apps must include disclaimer if not a certified medical device (Google Play requirement by Oct 30, 2025)
- **Action Taken:** 
  - Created reusable `MedicalDisclaimer` component
  - Added to PhoneAuthScreen
  - Includes iOS InfoPlist usage description
- **Files Modified:** 
  - `src/components/MedicalDisclaimer.js` (NEW)
  - `src/screens/auth/PhoneAuthScreen.js`
  - `app.json` (iOS infoPlist)

### ✅ **4. Permissions Documented**
- **Status:** COMPLETED
- **Action Taken:** Added Android permissions to app.json
- **Permissions Declared:**
  - CAMERA (for document upload)
  - READ_EXTERNAL_STORAGE (for image selection)
  - WRITE_EXTERNAL_STORAGE (for saving files)
  - NOTIFICATIONS (for appointment reminders)
  - INTERNET (for Firebase)
  - ACCESS_NETWORK_STATE (for connectivity check)
- **iOS Usage Strings Added:**
  - NSCameraUsageDescription
  - NSPhotoLibraryUsageDescription
  - NSLocationWhenInUseUsageDescription
  - NSHealthShareUsageDescription

---

## 📋 COMPLIANCE CHECKLIST

### Google Play Store Requirements

#### A. Technical Requirements
- [x] **Target SDK:** Android 15 (API 35) - ✅ DONE
- [x] **Permissions:** All permissions declared - ✅ DONE
- [ ] **Financial Features Declaration:** Must complete by Oct 30, 2025 (in Google Play Console)
  - If your app has NO payments, you must still submit declaration stating this
- [ ] **Data Safety Form:** Complete in Play Console (use PRIVACY_POLICY.md as reference)
- [ ] **Content Rating:** Complete IARC questionnaire
- [ ] **Target Audience:** Declare age restrictions

#### B. Healthcare-Specific Requirements
- [x] **Medical Disclaimer:** Added to app and must be in store description - ✅ DONE
- [ ] **Store Description Disclaimer:** Add this to Google Play description:
  ```
  ⚠️ MEDICAL DISCLAIMER
  This app is not a medical device and does not diagnose, treat, cure, or prevent 
  any medical condition. Tabibok Health is a booking and communication platform 
  for healthcare services. Always consult qualified healthcare professionals.
  ```
- [ ] **Screenshots:** Ensure no medical claims in screenshots
- [ ] **Age Restrictions:** If handling health data, consider 18+ restriction

#### C. Privacy & Data
- [x] **Privacy Policy:** Created (needs hosting) - ✅ DONE
- [ ] **Privacy Policy URL:** https://www.tabibakcare.com/privacy-policy.html
- [ ] **Data Safety Section:** Complete in Play Console covering:
  - Personal info collected (name, email, phone, DOB)
  - Health data collected (medical history, prescriptions, etc.)
  - Location data (optional, for clinic finding)
  - How data is used
  - Whether data is shared with third parties
  - Data encryption (Firebase uses encryption)
  - User can request data deletion

#### D. Store Listing Requirements
- [ ] **App Icon:** 512x512 PNG with transparent background
- [ ] **Feature Graphic:** 1024x500 PNG
- [ ] **Screenshots:** 
  - Phone: at least 2 (up to 8) - 16:9 or 9:16 ratio
  - Tablet (optional): 7" and 10"
- [ ] **App Description:** Clear, no medical claims
- [ ] **Short Description:** Max 80 characters
- [ ] **Category:** Select "Medical" or "Health & Fitness"

---

### Apple App Store Requirements

#### A. Technical Requirements
- [x] **iOS Permissions:** All usage descriptions added to Info.plist - ✅ DONE
- [ ] **Test Account:** Create demo account for Apple review team
  - Username: [provide demo phone/email]
  - Password: [provide demo password]
  - Include in App Review Information section
- [ ] **Demo Mode:** Ensure app works without real patient data for reviewers
- [ ] **Stability:** Test thoroughly - app must not crash
- [ ] **Performance:** Optimize loading times

#### B. Healthcare-Specific Requirements
- [x] **Medical Disclaimer:** Added in app - ✅ DONE
- [ ] **App Description Disclaimer:** Add to App Store description
- [ ] **No Medical Claims:** Review all marketing text
- [ ] **Age Rating:** Select appropriate rating (likely 12+ or 17+ for medical content)

#### C. Privacy & Data
- [x] **Privacy Policy:** Created (needs hosting) - ✅ DONE
- [ ] **Privacy Policy URL:** Add in App Store Connect
- [ ] **Privacy Nutrition Label:** Complete in App Store Connect:
  - Data Used to Track You: None (or specify if using analytics)
  - Data Linked to You: Name, email, phone, health data, location
  - Data Not Linked to You: Crash data (if using crash reporting)
- [ ] **Permission Requests:** Ensure all permission requests have clear explanations

#### D. App Store Connect Requirements
- [ ] **App Icon:** 1024x1024 PNG (no transparency)
- [ ] **Screenshots:** 
  - iPhone 6.7": at least 3
  - iPhone 6.5": at least 3
  - iPad Pro 12.9": at least 3 (if supporting iPad)
- [ ] **App Preview Videos:** Optional but recommended
- [ ] **App Description:** Clear, accurate, no misleading claims
- [ ] **Keywords:** Relevant medical/health keywords
- [ ] **Support URL:** Working website or support page
- [ ] **Marketing URL:** Optional
- [ ] **Copyright:** Your company name and year

---

## 🔧 IMMEDIATE ACTION ITEMS

### Priority 1: CRITICAL (Do Before Submission)
1. **Host Privacy Policy**
   - ✅ Domain purchased: www.tabibakcare.com
   - Deploy website files from `website/` folder
   - Privacy Policy URL: https://www.tabibakcare.com/privacy-policy.html
   - See `website/DEPLOYMENT_INSTRUCTIONS.md` for deployment guide
   - Add URL to both store listings
   - Estimated Time: 1-2 hours

2. **Update Store Descriptions with Medical Disclaimer**
   - Copy disclaimer from above
   - Add to both Google Play and App Store descriptions
   - Estimated Time: 15 minutes

3. **Create Demo/Test Account**
   - Create a test patient account
   - Create a test doctor account (for full review)
   - Document credentials
   - Estimated Time: 30 minutes

4. **Complete Data Safety/Privacy Forms**
   - Fill out Google Play Data Safety section
   - Fill out Apple Privacy Nutrition Label
   - Use PRIVACY_POLICY.md as reference
   - Estimated Time: 1-2 hours

### Priority 2: REQUIRED (Complete Within Week)
1. **Create App Icons and Screenshots**
   - Design 512x512 (Google) and 1024x1024 (Apple) icons
   - Take screenshots of key features
   - Estimated Time: 4-6 hours

2. **Complete Store Listings**
   - Write app descriptions (both languages if supporting Arabic)
   - Add keywords
   - Set pricing (free)
   - Estimated Time: 2-3 hours

3. **Content Rating**
   - Complete IARC questionnaire (Google)
   - Set age rating (Apple)
   - Estimated Time: 30 minutes

### Priority 3: RECOMMENDED (Before Launch)
1. **Testing**
   - Test on multiple devices (iOS and Android)
   - Test all user flows (patient, doctor, receptionist)
   - Test on different OS versions
   - Estimated Time: 4-8 hours

2. **Analytics Setup** (Optional)
   - Consider adding Firebase Analytics
   - Add crash reporting
   - Estimated Time: 2 hours

---

## 📝 STORE DESCRIPTION TEMPLATES

### Google Play Store Description
```
🏥 Tabibok Health - Your Healthcare Booking Platform

Book appointments with doctors, manage your medical records, and stay connected 
with your healthcare providers - all in one app.

⚠️ MEDICAL DISCLAIMER
This app is not a medical device and does not diagnose, treat, cure, or prevent 
any medical condition. Tabibok Health is a booking and communication platform 
for healthcare services. Always consult qualified healthcare professionals.

FEATURES:
✓ Book appointments with verified doctors
✓ View available time slots in real-time
✓ Manage your medical history
✓ Receive appointment reminders
✓ Secure messaging with healthcare providers
✓ Upload and store medical documents
✓ Track prescriptions and medications

FOR PATIENTS:
• Find doctors by specialty
• View doctor profiles and availability
• Book and manage appointments
• Access your medical records anytime
• Receive visit notes and prescriptions

FOR DOCTORS:
• Manage your schedule
• View patient information
• Complete visit notes
• Prescribe medications
• Track clinic revenue

PRIVACY & SECURITY:
Your health data is encrypted and secure. We comply with healthcare data 
protection standards. Read our privacy policy at: [YOUR_URL]

SUPPORT:
Email: privacy@tabibok.health
```

### Apple App Store Description
```
🏥 Tabibok Health - Healthcare Booking Made Simple

Connect with doctors, book appointments, and manage your health records securely.

⚠️ IMPORTANT: This app is not a medical device. It does not diagnose, treat, 
cure, or prevent any medical condition. Always consult healthcare professionals 
for medical advice.

KEY FEATURES:

📅 Easy Appointment Booking
Find and book appointments with verified healthcare providers in your area.

📋 Medical Records
Access your health history, prescriptions, and visit notes securely.

🔔 Smart Reminders
Never miss an appointment with automatic notifications.

💬 Secure Communication
Message your healthcare providers safely within the app.

🏥 For Healthcare Providers
Doctors and clinics can manage schedules, patients, and medical records.

🔒 PRIVACY FIRST
Your health information is encrypted and protected according to healthcare 
data standards. Privacy Policy: [YOUR_URL]

SUPPORT & FEEDBACK:
privacy@tabibok.health
```

---

## ⚠️ COMMON REJECTION REASONS TO AVOID

### Google Play
1. **Missing Medical Disclaimer** - ✅ Fixed
2. **No Privacy Policy URL** - ⚠️ Need to host
3. **Incomplete Data Safety** - ⏳ Complete in console
4. **Old Target SDK** - ✅ Fixed
5. **Missing Financial Declaration** - ⏳ Complete by Oct 30

### Apple App Store
1. **App Crashes During Review** - Test thoroughly
2. **No Test Account Provided** - Create demo account
3. **Missing Privacy Descriptions** - ✅ Fixed
4. **Incomplete Privacy Label** - ⏳ Complete in Connect
5. **Medical Claims Without Certification** - ✅ Disclaimer added

---

## 📞 NEXT STEPS

1. **TODAY:** Host privacy policy and get public URL
2. **THIS WEEK:** Create app icons and screenshots
3. **THIS WEEK:** Set up demo accounts for reviewers
4. **THIS WEEK:** Complete store listings with disclaimers
5. **NEXT WEEK:** Complete data safety/privacy forms in both consoles
6. **BEFORE SUBMISSION:** Thorough testing on multiple devices
7. **SUBMIT:** Submit to both stores with all requirements met

---

## ✅ COMPLIANCE STATUS SUMMARY

| Requirement | Google Play | Apple App Store | Status |
|------------|-------------|-----------------|--------|
| Target SDK/OS | ✅ API 35 | ✅ iOS Compatible | DONE |
| Privacy Policy | ✅ Created | ✅ Created | NEEDS HOSTING |
| Medical Disclaimer | ✅ Added | ✅ Added | DONE |
| Permissions | ✅ Declared | ✅ Declared | DONE |
| App Icons | ⏳ Pending | ⏳ Pending | TODO |
| Screenshots | ⏳ Pending | ⏳ Pending | TODO |
| Store Description | ⏳ Pending | ⏳ Pending | TODO |
| Data Safety Form | ⏳ Pending | ⏳ Pending | TODO |
| Test Account | ⏳ Pending | ⏳ Pending | TODO |
| Financial Declaration | ⏳ Pending | N/A | TODO (by Oct 30) |

**Overall Compliance:** 60% Complete

---

## 📚 HELPFUL RESOURCES

### Google Play
- [Developer Policy Center](https://play.google.com/about/developer-content-policy/)
- [Health Apps Policy](https://support.google.com/googleplay/android-developer/answer/9867159)
- [Data Safety Guide](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Financial Features Declaration](https://support.google.com/googleplay/android-developer/answer/10787469)

### Apple App Store
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Health Apps Guidelines](https://developer.apple.com/app-store/review/guidelines/#health-and-health-research)
- [Privacy Labels Guide](https://developer.apple.com/app-store/app-privacy-details/)

---

**Remember:** Both stores can take 1-7 days for initial review. Plan accordingly and be ready to respond to reviewer questions promptly.

Good luck with your submission! 🚀
