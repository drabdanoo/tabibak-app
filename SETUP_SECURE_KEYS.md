# 🔐 Secure Key Setup Guide

**IMPORTANT:** Never commit service account keys to GitHub!

---

## ✅ Setup Instructions

### **Step 1: Create `.env` File (LOCAL ONLY)**

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your actual values:
   ```
   FIREBASE_TYPE=service_account
   FIREBASE_PROJECT_ID=medconnect-2
   FIREBASE_PRIVATE_KEY_ID=your_actual_key_id
   FIREBASE_PRIVATE_KEY=your_actual_private_key
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@medconnect-2.iam.gserviceaccount.com
   FIREBASE_CLIENT_ID=118206513759178078560
   FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
   FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
   FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
   FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40medconnect-2.iam.gserviceaccount.com
   ```

3. **NEVER commit `.env` to GitHub** - it's in `.gitignore`

### **Step 2: Get Your Service Account Key**

1. Go to: https://console.cloud.google.com/
2. IAM & Admin → Service Accounts
3. Click: `firebase-adminsdk-fbsvc@medconnect-2.iam.gserviceaccount.com`
4. Keys tab → Create Key → JSON
5. Download the JSON file
6. Copy the values to your `.env` file
7. Delete the downloaded JSON file

### **Step 3: Verify Setup**

Test that your `.env` is working:
```bash
# This should NOT show your .env file
git status

# This should show .env is ignored
git check-ignore -v .env
```

### **Step 4: For Production (Cloud Functions)**

Cloud Functions automatically use the service account, so you don't need to do anything special. Just deploy:

```bash
firebase deploy --only functions
```

---

## 📋 Checklist

- [ ] Created `.env` file from `.env.example`
- [ ] Filled in actual service account values
- [ ] Verified `.env` is in `.gitignore`
- [ ] Tested that `.env` is ignored by git
- [ ] Deleted any downloaded JSON key files
- [ ] Verified Cloud Functions work
- [ ] Committed `.env.example` (NOT `.env`)

---

## ⚠️ Security Rules

### **DO:**
✅ Store keys in `.env` (local development)  
✅ Use environment variables in code  
✅ Use Google Cloud Secret Manager (production)  
✅ Rotate keys every 90 days  
✅ Use different keys for different environments  
✅ Enable Cloud Audit Logs  
✅ Review access logs regularly  

### **DON'T:**
❌ Commit `.env` to GitHub  
❌ Share keys in chat or email  
❌ Hardcode keys in source code  
❌ Use same key for multiple services  
❌ Store keys in public folders  
❌ Forget to delete old keys  
❌ Ignore key rotation  

---

## 🔄 Key Rotation

Rotate your service account key every 90 days:

1. Go to Google Cloud Console
2. Create a new key (JSON)
3. Update your `.env` file
4. Test that everything works
5. Delete the old key
6. Document the rotation date

---

## 🆘 Troubleshooting

### **Error: "Cannot find module 'dotenv'"**
```bash
npm install dotenv
```

### **Error: "Service account key not found"**
- Check `.env` file exists
- Check all values are filled in
- Check no quotes around values

### **Error: "Permission denied"**
- Check service account has correct roles
- Check Cloud Functions have correct permissions
- Check Firestore security rules allow access

---

## 📚 References

- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Environment Variables Best Practices](https://12factor.net/config)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager)

---

**Last Updated:** October 29, 2025  
**Status:** Active
