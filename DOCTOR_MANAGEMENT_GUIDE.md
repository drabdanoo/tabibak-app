# MedConnect Doctor Management Tool

A secure command-line tool for managing doctor accounts in MedConnect.

## 🚀 Setup Instructions

### 1. Download Service Account Key
1. Go to [Firebase Console](https://console.firebase.google.com/project/medconnect-2/settings/serviceaccounts/adminsdk)
2. Click "Generate new private key"
3. Save the file as `service-account-key.json` in the project root
4. **Keep this file secure and never commit it to git!**

### 2. Install Dependencies
```bash
npm install
```

## 📖 Usage

### Add a New Doctor
```bash
node manage-doctors.js add "Dr. Ahmed Hassan" "ahmed@hospital.com" "طب الأطفال"
```

### List All Doctors
```bash
node manage-doctors.js list
```

### Delete a Doctor
```bash
# Step 1: Get deletion confirmation and user ID
node manage-doctors.js delete "ahmed@hospital.com"

# Step 2: Confirm deletion (copy the user ID from step 1)
node manage-doctors.js delete-confirm "ahmed@hospital.com" "firebase-auth-uid-here"
```

> **Note:** For permissions to work correctly, the Firestore document ID for each doctor must match their Firebase Auth UID. The management tool ensures this automatically when creating or deleting accounts.

## 🔐 Security Features

- ✅ **Secure Random Passwords**: Auto-generated 12-character passwords
- ✅ **Temporary Password System**: Doctors must change password on first login
- ✅ **Email Verification Required**: Account not fully active until verified
- ✅ **Complete Cleanup**: Proper deletion from both Auth and Firestore
- ✅ **Local Execution**: Runs on your machine, no web interface

## 📝 Doctor Creation Process

1. **You run the command** → Creates account with secure temp password
2. **Tool displays credentials** → Copy the message to send to doctor
3. **Send message to doctor** → Via WhatsApp, SMS, or secure email
4. **Doctor logs in** → Must change password immediately

## 📧 Message Template

When you create a doctor, the tool will display this message to send:

```
مرحباً بك في نظام MedConnect الطبي

تم إنشاء حسابك بنجاح:
البريد الإلكتروني: doctor@example.com
كلمة المرور المؤقتة: ABC123def456

الرجاء:
1. تسجيل الدخول: https://medconnect-2.web.app/doctor.html
2. تغيير كلمة المرور عند أول دخول

مع تحيات فريق MedConnect
```

## 🎯 Examples

### Create a Pediatrician
```bash
node manage-doctors.js add "د. فاطمة محمد" "fatima@clinic.com" "طب الأطفال"
```

### Create a Cardiologist
```bash
node manage-doctors.js add "د. عمر أحمد" "omar@hospital.com" "طب القلب"
```

### View All Doctors
```bash
node manage-doctors.js list
```

## ⚠️ Important Security Notes

1. **Never share service-account-key.json**
2. **Send credentials securely** (WhatsApp, encrypted email)
3. **Verify doctor identity** before creating accounts
4. **Monitor first logins** to ensure doctors change passwords
5. **Keep this tool on your local machine only**

## 🔧 Troubleshooting

### "service-account-key.json not found"
- Download the service account key from Firebase Console
- Place it in the project root directory

### "Permission denied"
- Make sure your Firebase project has the correct permissions
- Ensure the service account key is valid

### "Email already exists"
- Check if doctor already has an account
- Use `node manage-doctors.js list` to see existing doctors

## 🎉 Success!

You now have a secure, simple way to manage doctor accounts without needing a complex admin panel!