# 🚨 Security Incident Response - Service Account Key Exposure

**Date:** October 29, 2025  
**Severity:** CRITICAL  
**Status:** In Progress

---

## 📋 Incident Summary

**What Happened:**
- Service account key was accidentally committed to GitHub
- Key ID: `cb0342fa6194ab1a7635e7742be804af84a15653`
- Service Account: `firebase-adminsdk-fbsvc@medconnect-2.iam.gserviceaccount.com`
- File: `service-account-key.json`
- Discovered by: Google Cloud Platform

**Risk Level:** 🔴 **CRITICAL**
- Anyone with this key can access your Firebase project
- Could read/write/delete data
- Could incur unauthorized charges
- Could compromise patient data

---

## ✅ Immediate Actions (COMPLETED)

### **Step 1: Disable the Exposed Key**
- [ ] Log in to Google Cloud Console
- [ ] Go to: IAM & Admin → Service Accounts
- [ ] Find: `firebase-adminsdk-fbsvc@medconnect-2.iam.gserviceaccount.com`
- [ ] Click on service account
- [ ] Go to: Keys tab
- [ ] Find key ID: `cb0342fa6194ab1a7635e7742be804af84a15653`
- [ ] Click 3-dot menu → Delete
- [ ] Confirm deletion

### **Step 2: Create New Service Account Key**
- [ ] In same service account, click: Create Key
- [ ] Select: JSON format
- [ ] Download new key file
- [ ] **STORE SECURELY** - don't commit to GitHub!

### **Step 3: Remove from GitHub**
- [ ] Delete `service-account-key.json` from GitHub
- [ ] Use git to remove from history:
  ```bash
  git rm --cached service-account-key.json
  git commit -m "Remove exposed service account key"
  git push origin main
  ```

### **Step 4: Update `.gitignore`**
- [ ] Added patterns to prevent future exposure:
  ```
  service-account-key.json
  *-key.json
  *-credentials.json
  firebase-key.json
  secrets/
  credentials/
  ```

### **Step 5: Update Code**
- [ ] Replace hardcoded key with environment variables
- [ ] Use `.env` file for local development
- [ ] Use Google Cloud Secret Manager for production

---

## 🔍 Security Audit Checklist

### **Access Review**
- [ ] Check Cloud Logging for suspicious activity
- [ ] Review API calls from exposed key
- [ ] Check for unauthorized data access
- [ ] Review billing for unusual charges
- [ ] Check for new service accounts created
- [ ] Review IAM role changes

### **Account Security**
- [ ] Enable 2FA on Google account
- [ ] Review recent login activity
- [ ] Check connected apps & services
- [ ] Review OAuth consent screen
- [ ] Check for unauthorized API keys

### **Project Security**
- [ ] Review all service account keys
- [ ] Delete unused keys
- [ ] Rotate all keys regularly
- [ ] Enable Cloud Audit Logs
- [ ] Enable VPC Service Controls
- [ ] Enable Binary Authorization

---

## 🔐 Secure Key Management

### **DO's:**
✅ Use environment variables for keys  
✅ Store keys in `.env` (in `.gitignore`)  
✅ Use Google Cloud Secret Manager  
✅ Use Firebase Secrets for Cloud Functions  
✅ Rotate keys regularly (every 90 days)  
✅ Use service account impersonation  
✅ Enable Cloud Audit Logs  
✅ Restrict key permissions (least privilege)  

### **DON'Ts:**
❌ Don't commit keys to GitHub  
❌ Don't share keys via email  
❌ Don't hardcode keys in source code  
❌ Don't use keys in client-side code  
❌ Don't store keys in public folders  
❌ Don't use same key for multiple services  
❌ Don't forget to delete old keys  
❌ Don't ignore key rotation  

---

## 📝 Secure Implementation Example

### **Before (❌ INSECURE):**
```javascript
// functions/index.js
const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
```

### **After (✅ SECURE):**
```javascript
// functions/index.js
const admin = require('firebase-admin');

// For Cloud Functions (automatic)
admin.initializeApp();

// For local development (use .env)
if (process.env.FIREBASE_CONFIG) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
```

### **.env File (Local Development Only):**
```
FIREBASE_CONFIG={"type":"service_account","project_id":"medconnect-2",...}
```

### **.env.example (Commit to GitHub):**
```
# Copy this file to .env and fill in your values
FIREBASE_CONFIG={"type":"service_account","project_id":"medconnect-2",...}
```

---

## 🚀 Prevention for Future

### **1. GitHub Protection**
- [ ] Enable branch protection rules
- [ ] Require code reviews
- [ ] Enable secret scanning
- [ ] Set up pre-commit hooks

### **2. Pre-commit Hook**
Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash
# Prevent committing sensitive files
if git diff --cached --name-only | grep -E "(service-account|credentials|\.env)" | grep -v "\.example"; then
  echo "ERROR: Attempting to commit sensitive files!"
  echo "Add to .gitignore and try again."
  exit 1
fi
```

### **3. GitHub Secrets Scanning**
- [ ] Enable in repository settings
- [ ] Configure custom patterns
- [ ] Set up notifications

### **4. Regular Audits**
- [ ] Monthly: Review all keys
- [ ] Quarterly: Rotate all keys
- [ ] Quarterly: Audit IAM roles
- [ ] Quarterly: Review Cloud Logging

---

## 📞 Contact & Support

**If you need help:**
1. Google Cloud Support: https://cloud.google.com/support
2. Firebase Support: https://firebase.google.com/support
3. GitHub Security: https://github.com/security

**Report Security Issues:**
- Google Cloud: https://cloud.google.com/security/responsible-disclosure
- Firebase: https://firebase.google.com/support/contact/security-bugs

---

## 📊 Timeline

| Date | Action | Status |
|------|--------|--------|
| Oct 29, 2025 | Received notification from Google | ✅ |
| Oct 29, 2025 | Disabled exposed key | ⏳ TODO |
| Oct 29, 2025 | Created new key | ⏳ TODO |
| Oct 29, 2025 | Removed from GitHub | ⏳ TODO |
| Oct 29, 2025 | Updated `.gitignore` | ✅ |
| Oct 29, 2025 | Reviewed access logs | ⏳ TODO |
| Oct 30, 2025 | Completed security audit | ⏳ TODO |

---

## ✅ Sign-Off

- [ ] All immediate actions completed
- [ ] No unauthorized access detected
- [ ] New key generated and tested
- [ ] Code updated to use environment variables
- [ ] `.gitignore` updated
- [ ] Team notified
- [ ] Documentation updated
- [ ] Incident closed

---

**Report Generated:** October 29, 2025  
**Next Review:** After all actions completed  
**Responsible:** Development Team
