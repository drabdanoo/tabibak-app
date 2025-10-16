# Current Doctor Credentials

## Active Doctor Accounts

After the selective cleanup, you now have **1 active doctor** in the system:

### Dr. John Smith
- **Email**: `vipsnapchat69@gmail.com`
- **Specialty**: Cardiology  
- **Fee**: 20 IQD
- **Status**: pending_first_login (needs password reset)
- **Firestore ID**: jp9ZeeCcdxFnYgbV64pv

## Reserved Email Addresses

These emails are configured in the allowlist but don't have active profiles yet:
- `obaidaalluhebe@gmail.com` - Reserved for future doctor account
- `dr.abdanoo@gmail.com` - Reserved for future doctor account

## How to Access Doctor Dashboard

1. Go to `doctor.html` 
2. Use email: `vipsnapchat69@gmail.com`
3. If this is the first login, you'll need to use password reset
4. Or create the account using the manage-doctors.js script

## Creating New Doctor Accounts

To add the reserved doctors:
```bash
node manage-doctors.js create
```

Then follow the prompts to create accounts for:
- obaidaalluhebe@gmail.com
- dr.abdanoo@gmail.com

## System Status

✅ Cleanup completed - 8 unwanted doctors removed
✅ Dr. John Smith preserved as requested  
✅ Config files updated with clean allowlist
✅ Seed data cleaned of removed doctors
✅ Debug files updated with correct test email
✅ Password file updated with current credentials

---
*Last updated: $(15/10)*