# Firebase App Check Configuration Guide

## 🛡️ Complete Setup Instructions

### Step 1: Enable App Check in Firebase Console

1. **Open Firebase Console**
   - Go to https://console.firebase.google.com/
   - Select your project: **medconnect-2**

2. **Navigate to App Check**
   - In the left sidebar, scroll down and click **"App Check"**
   - Click **"Get Started"**

3. **Register Your Web App**
   - Click **"Add an app"** or find your existing web app
   - Select your web app (1:464755135042:web:ac00e07a1aa0721683d3db)

### Step 2: Set up ReCAPTCHA v3 Provider

1. **Get ReCAPTCHA v3 Keys**
   - Go to https://www.google.com/recaptcha/admin/
   - Click **"Create"** (or use existing)
   - Choose **"reCAPTCHA v3"**
   - Add domains:
     - `localhost` (for development)
     - `medconnect-2.firebaseapp.com` (your production domain)
     - Any other domains you use

2. **Configure in Firebase**
   - Back in Firebase Console > App Check
   - Click **"Add provider"** for your web app
   - Select **"ReCAPTCHA v3"**
   - Enter your **Site Key** from Google ReCAPTCHA
   - Enter your **Secret Key** from Google ReCAPTCHA
   - Click **"Save"**

### Step 3: Update Your Code

**Replace the placeholder site key in your code:**

In these files:
- `patient.html` (line ~981)
- (admin.html archived - now using CLI tool manage-doctors.js)
- `doctor.html` (line ~443)
- `test-app-check.html` (line ~127)

Replace this line:
```javascript
'6LcX8IAqAAAAAIjsL8k5yUiYQJ8K3K1K3mOZjn7N', // Replace with your actual site key
```

With your actual ReCAPTCHA v3 site key:
```javascript
'YOUR_ACTUAL_RECAPTCHA_SITE_KEY', // Your real ReCAPTCHA v3 site key
```

### Step 4: Enforce App Check (Optional but Recommended)

1. **In Firebase Console > App Check**
   - Click **"Apps"** tab
   - Find your web app
   - Toggle **"Enforce"** to ON

2. **Configure for Your Services**
   - Go to **"APIs"** tab
   - Enable App Check for:
     - **Cloud Firestore** ✅
     - **Firebase Authentication** ✅
     - **Cloud Functions** ✅

### Step 5: Test Your Implementation

1. **Open Test Page**
   - Visit: http://localhost:3000/test-app-check.html
   - Check all status indicators are green ✅

2. **Test Main App**
   - Visit: http://localhost:3000/patient.html
   - Ensure authentication and database access work

3. **Monitor Console**
   - Check browser console for App Check logs
   - Look for successful token generation

### Expected Results

✅ **Success Indicators:**
- No App Check errors in console
- Database operations work normally  
- Authentication flows continue working
- ReCAPTCHA challenges are invisible to users

⚠️ **Common Issues:**
- **"app-check/token-required"**: App Check enforced but no valid token
- **"app-check/invalid-token"**: Wrong site key or expired token
- **Network errors**: Check domain configuration in ReCAPTCHA

### Security Benefits

🔒 **App Check provides:**
- Protection against abuse and bot traffic
- Verification that requests come from your genuine app
- Additional security layer for Firebase services
- Reduced risk of quota exhaustion attacks

### Development vs Production

**Development:**
- Use `localhost` in ReCAPTCHA domains
- Consider debug tokens for testing
- Monitor console for detailed logs

**Production:**
- Use your actual domain
- Enable enforcement
- Monitor usage in Firebase Console

### Troubleshooting

If you encounter issues:

1. **Check ReCAPTCHA Configuration**
   - Verify domains are correct
   - Ensure v3 (not v2) is selected
   - Check site key matches code

2. **Verify Firebase Configuration**
   - App Check provider is properly configured
   - Correct secret key entered
   - App is registered correctly

3. **Test in Incognito Mode**
   - Eliminates browser cache issues
   - Fresh ReCAPTCHA evaluation

4. **Check Network Requests**
   - Look for successful token requests
   - Monitor Firebase App Check APIs
   - Verify no CORS issues

---

## Next Steps After Setup

Once App Check is working:
1. Monitor token generation in console
2. Check Firebase Console > App Check > Usage for metrics  
3. Consider implementing custom providers for mobile apps
4. Set up monitoring/alerting for App Check failures

**Your medical app will now be protected against unauthorized access! 🛡️**