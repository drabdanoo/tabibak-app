# Firestore Setup Requirements

## Overview
The Tabibok Health application requires several Firestore indexes and security rules to be properly configured. This document outlines the manual steps needed in the Firebase Console.

---

## 1. Firestore Security Rules

### Current Status: ✅ UPDATED
All security rules have been updated in `firestore.rules` file including:
- Added `specialties` collection read access for authenticated users
- All other collections configured with proper role-based access control (RBAC)

### Next Step
Deploy the updated rules to Firebase:

```bash
firebase deploy --only firestore:rules
```

---

## 2. Firestore Indexes

### Required Indexes

#### Index 1: Doctors Collection (Rating + Name)
**Purpose**: Sorting doctors by rating and name  
**Collection**: `doctors`  
**Fields**: 
- `listed` (Ascending)
- `rating` (Descending) 
- `name` (Ascending)
- `__name__` (Ascending)

**Manual Setup**:
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project `medconnect-2`
3. Navigate to **Firestore Database** → **Indexes** → **Composite Indexes**
4. Click **Create Index**
5. Set Collection ID: `doctors`
6. Add fields in order:
   - Field: `listed` → Order: `Ascending`
   - Field: `rating` → Order: `Descending`
   - Field: `name` → Order: `Ascending`
   - Field: `__name__` → Order: `Ascending`
7. Click **Create Index**

**Alternative - Automatic Creation**:
When you run the app and trigger a query that needs this index, Firebase will provide a link to auto-create it. The link will look like:
```
https://console.firebase.google.com/v1/r/project/medconnect-2/firestore/indexes?create_composite=...
```

Simply click the link and confirm to auto-create the index.

---

#### Index 2: Doctors Collection (Clinic)
**Purpose**: Filtering doctors by clinic  
**Collection**: `doctors`  
**Fields**:
- `clinic` (Ascending)
- `listed` (Ascending)
- `__name__` (Ascending)

**Status**: Create as needed if you add clinic filtering

---

### Checking Index Status

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select **medconnect-2** project
3. Go to **Firestore Database** → **Indexes**
4. Look for the index with fields: `doctors / listed / rating / name / __name__`
5. Status should show as **Enabled** (green checkmark)

---

## 3. Collections Data Structure

### Specialties Collection
**Path**: `/specialties/{docId}`  
**Purpose**: Store available medical specialties for filtering

**Example Document**:
```json
{
  "name": "Cardiology",
  "description": "Heart and cardiovascular system",
  "icon": "heart"
}
```

### Doctors Collection
**Path**: `/doctors/{doctorId}`  
**Critical Fields**:
- `listed` (boolean) - Controls visibility
- `rating` (number) - Average rating
- `name` (string) - Doctor name
- `specialty` (string) - Medical specialty
- `hospital` (string) - Hospital/clinic name

---

## 4. Troubleshooting

### Error: "Missing or insufficient permissions"
**Cause**: Security rules don't allow the current user role to access the collection  
**Solution**:
1. Check user role is correctly set in Firestore (patient, doctor, receptionist, admin)
2. Verify security rules have been deployed: `firebase deploy --only firestore:rules`
3. Clear browser cache and refresh

### Error: "The query requires an index"
**Cause**: A composite index is needed for the specific query  
**Solution**:
1. Check Firebase Console for the suggested index link
2. Click the link to auto-create, OR
3. Manually create the index following the steps in Section 2

### Anonymous User Access Issues
**Cause**: Some collections have authentication requirements  
**Solution**:
- The app uses anonymous authentication for initial browsing
- Firestore rules now allow anonymous users to read `doctors` and `specialties` collections
- Sign in is required only for creating appointments or accessing personal data

---

## 5. Deployment Checklist

- [ ] Firestore rules deployed (`firebase deploy --only firestore:rules`)
- [ ] Doctors index created and showing "Enabled" status
- [ ] Specialties collection has read access
- [ ] Test anonymous user can browse doctors
- [ ] Test authenticated patient can book appointments
- [ ] Test doctor can view their appointments

---

## 6. App Initialization

The app performs these operations on first load:

1. **Anonymous Auth** - For unauthenticated browsing
2. **Read specialties** - To populate specialty filters
3. **Read doctors** - To show available doctors
4. **User role lookup** - When user authenticates

All these operations should complete without permission errors once the rules are deployed.

---

## Reference Links

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/rules)
- [Firestore Indexes Guide](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Create Composite Indexes](https://firebase.google.com/docs/firestore/query-data/index-overview#create-composite-indexes)

---

**Last Updated**: November 12, 2025  
**Status**: Ready for implementation
