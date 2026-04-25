# طبيبك — Tabibak

Arabic medical appointment booking platform for Mosul, Iraq.

**Web app** (Firebase Hosting) + **React Native mobile app** (Expo / EAS).

---

## Stack

| Layer | Technology |
|---|---|
| Web frontend | Vanilla JS, Tailwind CSS v4, Firebase JS SDK v9 |
| Mobile | React Native (Expo SDK 54), EAS Build |
| Backend | Firebase Cloud Functions v1 (Node 20) |
| Database | Firestore |
| Auth | Firebase Auth — phone OTP, email/password |
| Storage | Firebase Storage |
| SMS | Twilio |

---

## Project structure

```
/public          Web app (patient, doctor, receptionist portals)
/functions       Cloud Functions (Node 20, firebase-functions v6)
/scripts         One-off admin scripts (doctor import, backfill)
/tests           Firestore security rules tests (Jest)
/tabibak_react_native   React Native mobile app
firestore.rules  Firestore security rules
storage.rules    Storage security rules
```

---

## Local setup

### Web app

```bash
npm install
npm run css:build        # build Tailwind CSS
```

Serve `public/` with any static server or `firebase serve --only hosting`.

### Cloud Functions

```bash
cd functions
npm install
```

Twilio credentials live in `functions/medconnect-2.env` (not committed).
Copy the template and fill in your values:

```
TWILIO_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_PHONE_NUMBER="+1xxxxxxxxxx"
```

### Firestore rules tests

Requires the Firestore emulator:

```bash
# Terminal 1
firebase emulators:start --only firestore

# Terminal 2
npm test
```

Or in one command:
```bash
npm run test:rules
```

---

## Deployment

```bash
firebase deploy
```

Pre-deploy hook automatically rebuilds Tailwind CSS.

---

## Doctor import

2 028 doctors scraped from tabib.iq are seeded into Firestore via:

```bash
node scripts/import_tabib_doctors.js [path/to/tabib_doctors.csv]
```

Idempotent — uses a deterministic SHA-1 doc ID (name + address hash).
Set `featured: true` on a doctor document in Firestore to show it in the
**أطباء مميزون** section on the patient portal.

---

## Roles

| Role | Login method | Portal |
|---|---|---|
| Patient | Phone OTP or email | `patient.html` |
| Doctor | Email / password | `doctor.html` |
| Receptionist | Email / password | `receptionist.html` |
| Admin | Email / password + custom claim | Firebase console |
