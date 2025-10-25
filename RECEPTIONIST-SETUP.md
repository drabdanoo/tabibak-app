# 🏥 Receptionist Setup Guide

## Permanent Solution: Setup Receptionist with Custom Claims

### Prerequisites
- Node.js installed
- Firebase Admin SDK service account key in `functions/` folder
- Doctor UID (get from Firebase Console → Authentication)

---

## Option 1: Create NEW Receptionist User

Use this if you want to create a brand new receptionist account:

```bash
cd g:\tabibak-app
node functions/setup-receptionist.js --email receptionist@clinic.com --password YourSecurePassword123 --name "Sara Ahmed" --doctor-uid YOUR_DOCTOR_UID
```

**Replace:**
- `receptionist@clinic.com` → Receptionist's email
- `YourSecurePassword123` → Strong password
- `Sara Ahmed` → Receptionist's name
- `YOUR_DOCTOR_UID` → The doctor's Firebase UID

---

## Option 2: Setup EXISTING User as Receptionist

Use this if you already created a user account:

```bash
cd g:\tabibak-app
node functions/setup-receptionist.js --uid EXISTING_USER_UID --name "Sara Ahmed" --doctor-uid YOUR_DOCTOR_UID
```

**Replace:**
- `EXISTING_USER_UID` → The user's Firebase UID
- `Sara Ahmed` → Receptionist's name
- `YOUR_DOCTOR_UID` → The doctor's Firebase UID

---

## How to Get Doctor UID

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project: **medconnect-2**
3. Go to **Authentication** → **Users**
4. Find the doctor's email
5. Copy the **User UID** column

---

## What the Script Does

✅ **Step 1:** Creates user account (if using Option 1)  
✅ **Step 2:** Sets `receptionist: true` custom claim  
✅ **Step 3:** Creates receptionist document in Firestore  
✅ **Step 4:** Links receptionist to doctor  

---

## After Running the Script

1. **Deploy Firestore rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Test login:**
   - Go to: https://medconnect-2.web.app/receptionist.html
   - Login with the email/password
   - Should see the receptionist dashboard! 🎉

---

## Troubleshooting

### Error: "Missing or insufficient permissions"
- Make sure you deployed the Firestore rules after running the script
- The receptionist user must have the custom claim set
- Check Firebase Console → Authentication → Users → Click user → Custom Claims tab

### Error: "Receptionist profile not found"
- Make sure the script completed successfully
- Check Firestore Console → receptionists collection → Should see the document

### Error: "Email already exists"
- Use Option 2 instead (setup existing user)
- Or use a different email address

---

## Security Notes

⚠️ **Keep the service account key secure!**
- Never commit `medconnect-2-firebase-adminsdk-*.json` to Git
- This file has admin access to your Firebase project

✅ **Custom claims are secure:**
- Cannot be modified by client-side code
- Only Firebase Admin SDK can set them
- Verified on every Firestore request

---

## Example Output

```
📝 Creating new user account for: receptionist@clinic.com
✅ User created with UID: abc123xyz789

🔐 Setting receptionist custom claim for user: abc123xyz789
✅ Receptionist claim set successfully

📄 Creating receptionist document in Firestore
✅ Receptionist document created

============================================================
✅ RECEPTIONIST SETUP COMPLETE!
============================================================

👤 User Details:
   UID: abc123xyz789
   Email: receptionist@clinic.com
   Name: Sara Ahmed
   Doctor ID: doctor123uid

🔑 Login Credentials:
   Email: receptionist@clinic.com
   Password: YourSecurePassword123

🌐 Login URL: https://medconnect-2.web.app/receptionist.html

✨ The receptionist can now login and access the dashboard!
```

---

## Need Help?

If you encounter any issues, check:
1. Firebase Console → Authentication (user exists?)
2. Firebase Console → Firestore → receptionists collection (document exists?)
3. Browser Console (any JavaScript errors?)
