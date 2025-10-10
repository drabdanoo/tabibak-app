## Seeding doctors (production-safe)

This project includes a production-safe doctor seeding script using the Firebase Admin SDK.

Prerequisites:
- A Firebase service account with access to your project.
- Node 18+.

Auth setup options:
- Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of your service account JSON, or
- Set `SERVICE_ACCOUNT_JSON` to the JSON string of the service account.

Usage:
```bash
# Install admin SDK if not present
npm i firebase-admin --save-dev

# Dry run (no writes):
node scripts/seed-doctors.mjs --file seed/doctors.json --dry-run

# Apply changes:
node scripts/seed-doctors.mjs --file seed/doctors.json
```

Behavior:
- Upserts doctors by `email` (case-insensitive).
- Creates Auth users if not found (with random password if not provided).
- Sets sensible defaults and merges missing fields for existing docs.
- Idempotent and safe to re-run.

Notes:
- The former in-app seeding button was removed from `public/admin.html` and should not be used in production.

