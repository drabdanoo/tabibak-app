# 🔐 Custom Claims Setup Guide

## Step 1: Bootstrap Initial Admin User

1. **Open Custom Claims Manager**: `custom-claims-manager.html`
2. **Sign In Anonymously**: Click the sign-in button
3. **Create User Document**: Click "Create My User Document"
4. **Copy your UID** from the result

## Step 2: Set Admin Custom Claims (Manual)

1. **Open Firebase Console**: https://console.firebase.google.com/project/medconnect-2/authentication/users
2. **Find your user** using the UID you copied
3. **Click on your user**
4. **Scroll down to "Custom claims"**
5. **Click "Edit"**
6. **Enter**: `{"admin": true, "patient": false}`
7. **Click "Save"**

## Step 3: Verify Admin Access

1. **Sign out** and **sign back in** (to refresh token)
2. **Check authentication status** - should show "Admin" role
3. **Test role management functions**

## Step 4: Manage Other Users

Once you have admin access, you can:

### Assign Roles via UI:
- **Set User Role**: Enter any UID and select patient/doctor/admin
- **Promote to Doctor**: Convert users to doctors with profile info

### Available Roles:
- **👤 Patient**: Default role, can book appointments, access own data
- **👨‍⚕️ Doctor**: Can see patient data, manage appointments, access schedules
- **👑 Admin**: Full system access, can manage all users and roles

## Step 5: Update Your App Files

Your patient.html, doctor.html, and admin.html files should check roles:

```javascript
// Example role checking
auth.onAuthStateChanged(async (user) => {
  if (user) {
    const token = await user.getIdTokenResult();
    const claims = token.claims;
    
    if (claims.admin) {
      // Show admin features
    } else if (claims.doctor) {
      // Show doctor features  
    } else {
      // Show patient features
    }
  }
});
```

## Cloud Functions Available:

1. **setUserRole(uid, role)** - Admin sets any user's role
2. **promoteToDoctor(uid, doctorInfo)** - Admin promotes user to doctor
3. **getUserRole()** - Get current user's role and claims
4. **onUserCreate** - Auto-assigns patient role to new users

## Security Features:

✅ **Server-side validation**: Custom claims verified by Firebase
✅ **Role-based database rules**: Firestore rules enforce permissions
✅ **Automatic role assignment**: New users get patient role
✅ **Admin-only functions**: Role management requires admin claims
✅ **Token refresh**: Claims updated on next sign-in

## Testing:

Use the Custom Claims Manager to:
- ✅ Test authentication flow
- ✅ Verify database permissions  
- ✅ Test Cloud Functions
- ✅ Manage user roles
- ✅ View user directory
