# 🔥 Firebase Setup Guide for MedConnect

## URGENT: Fix API Key Expired Error

### Step 1: Generate New Firebase API Key
1. Go to **Firebase Console**: https://console.firebase.google.com/
2. Select your project: **medconnect-2**
3. Click **⚙️ Project Settings**
4. Scroll to **"Your apps"** section
5. Click on your **Web App** 
6. Copy the **NEW** `apiKey` from the config object
7. Replace the old API key in `config.js`

### Step 2: Enable Phone Authentication
1. In Firebase Console, go to **Authentication**
2. Click **Sign-in method** tab
3. Click **Phone** provider
4. Click **Enable** toggle
5. **Save** changes

### Step 3: Add Authorized Domains
1. Still in **Authentication → Settings**
2. Scroll to **Authorized domains**
3. Add these domains:
   - `localhost`
   - `127.0.0.1`
   - Your actual domain if deployed

### Step 4: Configure Firestore Rules
1. Go to **Firestore Database**
2. Click **Rules** tab
3. Replace rules with this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write for authenticated users
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Allow test collection for connection testing
    match /test/{document} {
      allow read, write: if true;
    }
  }
}
```

### Step 5: Update API Key in Code

The current expired API key in config.js:
```javascript
apiKey: "AIzaSyA_JehRWtDY5GEC2CMS3l0Lwo12soptEs8"  // EXPIRED!
```

Replace with NEW API key from Firebase Console.

## Error Details
- **Error 1**: `auth/api-key-expired` - API key needs renewal
- **Error 2**: `permission-denied` - Firestore rules too restrictive
- **Solution**: Update API key + Fix Firestore rules + Enable phone auth

## Testing Steps
1. Update API key
2. Deploy new Firestore rules
3. Refresh page
4. Try OTP registration again
5. Check browser console for success messages

---
**Next**: After fixing these, the OTP system should work perfectly! 🎯