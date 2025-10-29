# 🔐 Guest Account Setup for Testing

**Date:** October 30, 2025  
**Purpose:** Enable guest browsing in the app

---

## ⚠️ **Issue:**

Anonymous authentication is not enabled in Firebase, so guest login fails.

**Solution:** Create a guest email/password account

---

## ✅ **Step 1: Create Guest Account in Firebase**

1. Go to: https://console.firebase.google.com/
2. Select project: **medconnect-2**
3. Authentication → Users
4. Click **"Create user"**
5. Fill in:
   - **Email:** `guest@tabibak.app`
   - **Password:** `Guest@123456`
6. Click **"Create"**

---

## ✅ **Step 2: Verify in App**

1. Refresh the browser (Ctrl+Shift+R)
2. Click **"مريض"** (Patient)
3. Click **"تصفح كزائر"** (Browse as Guest)
4. Should now log in successfully!

---

## 📋 **Guest Account Details**

| Field | Value |
|-------|-------|
| Email | guest@tabibak.app |
| Password | Guest@123456 |
| Role | guest |
| Purpose | Testing without phone OTP |

---

## 🎯 **What Guest Can Do**

✅ Browse doctors  
✅ Search doctors  
✅ View doctor profiles  
✅ View reviews  
✅ Book appointments (limited)  
✅ Test UI/UX  

---

## 🔐 **Security Note**

This is a test account for development only. In production:
- Use proper anonymous authentication
- Enable App Check
- Use proper security rules

---

**After creating the account, guest login should work!** 🚀
