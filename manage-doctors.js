#!/usr/bin/env node

const admin = require('firebase-admin');
const crypto = require('crypto');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccountKey = path.join(__dirname, 'service-account-key.json');

try {
    const serviceAccount = require(serviceAccountKey);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://medconnect-2-default-rtdb.firebaseio.com'
    });
    console.log('🔥 Firebase Admin initialized successfully');
} catch (error) {
    console.error('❌ Error initializing Firebase Admin:');
    console.error('   Make sure service-account-key.json exists in the project root');
    console.error('   Download it from Firebase Console → Project Settings → Service Accounts');
    process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

// Generate secure random password
function generateSecurePassword(length = 12) {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return password;
}

// Generate doctor initials
function generateInitials(fullName) {
    if (!fullName) return 'د.م';
    const parts = fullName.split(' ');
    if (parts.length >= 2) {
        return `د.${parts[1].charAt(0)}`;
    }
    return `د.${parts[0].charAt(0)}`;
}

// Create doctor account
async function createDoctor(name, email, specialty, options = {}) {
    try {
        console.log('👨‍⚕️ Creating doctor account...');
        console.log(`   Name: ${name}`);
        console.log(`   Email: ${email}`);
        console.log(`   Specialty: ${specialty}`);
        
        // Generate secure temporary password
        const tempPassword = generateSecurePassword(12);
        
        // Step 1: Create Firebase Auth account
        console.log('\n🔐 Creating Firebase Authentication account...');
        const userRecord = await auth.createUser({
            email: email,
            password: tempPassword,
            displayName: name,
            emailVerified: false
        });
        
        console.log(`✅ Auth account created with UID: ${userRecord.uid}`);
        
        // Step 2: Set doctor role
        console.log('👔 Setting doctor permissions...');
        await auth.setCustomUserClaims(userRecord.uid, {
            doctor: true,
            patient: false,
            admin: false
        });
        
            // Step 3: Create Firestore profile with UID as document ID
            console.log('📄 Creating doctor profile...');
            const doctorData = {
                name: name,
                initials: generateInitials(name),
                specialty: specialty,
                phone: options.phone || '',
                email: email,
                fee: options.fee || '20',
                consultationFee: parseInt(options.fee || '20') * 1000,
                experience: options.experience || '5+ سنوات خبرة',
                rating: options.rating || '4.5',
                reviews: options.reviews || '25',
                location: options.location || 'العيادة الطبية',
                hours: options.hours || '9:00 ص - 5:00 م',
                education: options.education || 'بكالوريوس طب وجراحة',
                languages: options.languages || ['العربية'],
                specializations: options.specializations || [specialty],
                about: options.about || `طبيب متخصص في ${specialty} مع خبرة واسعة في المجال الطبي.`,
                userId: userRecord.uid,
                accountStatus: 'pending_first_login',
                tempPasswordSet: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // Use UID as document ID for Firestore profile
            await db.collection('doctors').doc(userRecord.uid).set(doctorData);

            // Add to users collection
            await db.collection('users').doc(userRecord.uid).set({
                uid: userRecord.uid,
                role: 'doctor',
                email: email,
                name: name,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ Doctor profile created with ID (matches UID): ${userRecord.uid}`);

            // Step 5: Display credentials and instructions
            console.log('\n' + '='.repeat(60));
            console.log('🎉 DOCTOR ACCOUNT CREATED SUCCESSFULLY!');
            console.log('='.repeat(60));
            console.log(`👨‍⚕️ Doctor: ${name}`);
            console.log(`📧 Email: ${email}`);
            console.log(`🔑 Temporary Password: ${tempPassword}`);
            console.log(`🆔 User ID: ${userRecord.uid}`);
            console.log(`� Profile ID: ${userRecord.uid}`);
            console.log('='.repeat(60));

            console.log('\n📝 NEXT STEPS:');
            console.log('1. Send the following message to the doctor:');
            console.log('\n' + '-'.repeat(50));
            console.log('مرحباً بك في نظام MedConnect الطبي');
            console.log('');
            console.log('تم إنشاء حسابك بنجاح:');
            console.log(`البريد الإلكتروني: ${email}`);
            console.log(`كلمة المرور المؤقتة: ${tempPassword}`);
            console.log('');
            console.log('الرجاء:');
            console.log('1. تسجيل الدخول: https://medconnect-2.web.app/doctor.html');
            console.log('2. تغيير كلمة المرور عند أول دخول');
            console.log('');
            console.log('مع تحيات فريق MedConnect');
            console.log('-'.repeat(50));

            console.log('\n2. Doctor must login and change password immediately');
            console.log('3. Account will be fully activated after first login\n');

            return {
                success: true,
                uid: userRecord.uid,
                doctorId: userRecord.uid,
                tempPassword: tempPassword
            };
        
    } catch (error) {
        console.error('\n❌ Error creating doctor:', error.message);
        
        // Cleanup on error
        try {
            if (error.code !== 'auth/email-already-exists') {
                const userRecord = await auth.getUserByEmail(email);
                await auth.deleteUser(userRecord.uid);
                console.log('🧹 Cleaned up partially created account');
            }
        } catch (cleanupError) {
            console.log('⚠️  Manual cleanup may be required');
        }
        
        throw error;
    }
}

// List all doctors
async function listDoctors() {
    try {
        console.log('📋 Loading all doctors...\n');
        
        const snapshot = await db.collection('doctors').orderBy('name').get();
        
        if (snapshot.empty) {
            console.log('No doctors found in the system.');
            return;
        }
        
        console.log('👨‍⚕️ DOCTORS IN SYSTEM:');
        console.log('='.repeat(80));
        
        snapshot.forEach((doc, index) => {
            const data = doc.data();
            console.log(`${index + 1}. ${data.name || 'Unknown'}`);
            console.log(`   Email: ${data.email}`);
            console.log(`   Specialty: ${data.specialty}`);
            console.log(`   Status: ${data.accountStatus || 'active'}`);
            console.log(`   Fee: ${data.fee} IQD`);
            console.log(`   ID: ${doc.id}`);
            console.log('   ' + '-'.repeat(40));
        });
        
        console.log(`\nTotal doctors: ${snapshot.size}`);
        
    } catch (error) {
        console.error('❌ Error listing doctors:', error.message);
    }
}

// List all Firebase Authentication users
async function listAuthUsers() {
    try {
        console.log('🔐 Loading Firebase Authentication users...\n');
        
        const listUsersResult = await admin.auth().listUsers(1000);
        
        if (listUsersResult.users.length === 0) {
            console.log('No users found in Firebase Authentication.');
            return;
        }
        
        console.log('🔑 FIREBASE AUTH USERS:');
        console.log('='.repeat(80));
        
        listUsersResult.users.forEach((userRecord, index) => {
            console.log(`${index + 1}. ${userRecord.email || 'No email set'}`);
            console.log(`   UID: ${userRecord.uid}`);
            console.log(`   Phone: ${userRecord.phoneNumber || 'No phone'}`);
            console.log(`   Email Verified: ${userRecord.emailVerified}`);
            console.log(`   Created: ${userRecord.metadata.creationTime}`);
            console.log(`   Claims: ${JSON.stringify(userRecord.customClaims || {})}`);
            console.log(`   Disabled: ${userRecord.disabled || false}`);
            console.log('   ' + '-'.repeat(40));
        });
        
        console.log(`\nTotal users in Firebase Auth: ${listUsersResult.users.length}`);
        
    } catch (error) {
        console.error('❌ Error listing auth users:', error.message);
    }
}

// Delete user from Firebase Authentication completely
async function deleteAuthUser(email) {
    try {
        console.log(`🗑️  Looking up user by email: ${email}`);
        
        const userRecord = await admin.auth().getUserByEmail(email);
        console.log(`   Found user: ${userRecord.uid}`);
        
        // Confirm deletion
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            readline.question(`❓ Are you sure you want to delete Firebase Auth user "${email}"? (y/N): `, resolve);
        });
        readline.close();
        
        if (answer.toLowerCase() !== 'y') {
            console.log('❌ Operation cancelled');
            return;
        }
        
        // Delete from Firebase Authentication
        await admin.auth().deleteUser(userRecord.uid);
        console.log(`✅ Successfully deleted Firebase Auth user: ${email}`);
        
        // Also try to clean up any related Firestore documents
        try {
            // Delete from doctors collection
            const doctorsQuery = await db.collection('doctors').where('email', '==', email).get();
            doctorsQuery.forEach(async (doc) => {
                await doc.ref.delete();
                console.log(`   🧹 Cleaned up doctor profile: ${doc.id}`);
            });
            
            // Delete from users collection
            await db.collection('users').doc(userRecord.uid).delete();
            console.log(`   🧹 Cleaned up user profile: ${userRecord.uid}`);
            
        } catch (cleanupError) {
            console.log(`   ⚠️  Firestore cleanup error (may not exist): ${cleanupError.message}`);
        }
        
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.log(`❌ No Firebase Auth user found with email: ${email}`);
        } else {
            console.error('❌ Error deleting auth user:', error.message);
        }
    }
}

// Delete doctor (with confirmation)
async function deleteDoctor(email) {
    try {
        console.log(`🗑️  Attempting to delete doctor: ${email}`);
        
        // Find doctor by email
        const doctorQuery = await db.collection('doctors').where('email', '==', email).get();
        
        if (doctorQuery.empty) {
            console.log('❌ Doctor not found in Firestore');
            return;
        }
        
        const doctorDoc = doctorQuery.docs[0];
        const doctorData = doctorDoc.data();
        
        console.log(`Found doctor: ${doctorData.name}`);
        console.log('⚠️  This will permanently delete the doctor account!');
        
        // Confirmation (you'll need to implement interactive confirmation)
        console.log('\nTo confirm deletion, run:');
        console.log(`node manage-doctors.js delete-confirm ${email} ${doctorData.userId}`);
        
    } catch (error) {
        console.error('❌ Error deleting doctor:', error.message);
    }
}

// Confirm deletion
async function confirmDelete(email, userId) {
    try {
        // Delete from Firebase Auth
        await auth.deleteUser(userId);
        console.log('✅ Deleted from Firebase Auth');
        
        // Delete from Firestore
        const doctorQuery = await db.collection('doctors').where('email', '==', email).get();
        doctorQuery.forEach(async (doc) => {
            await doc.ref.delete();
        });
        
        // Delete from users collection
        await db.collection('users').doc(userId).delete();
        
        console.log(`✅ Doctor ${email} completely deleted from system`);
        
    } catch (error) {
        console.error('❌ Error confirming deletion:', error.message);
    }
}

// Remove all doctors and their Firebase Auth accounts
async function removeAllDoctors() {
    try {
        console.log('🗑️  Starting bulk cleanup of all doctors...\n');
        
        // Get all doctors from Firestore
        const snapshot = await db.collection('doctors').get();
        
        if (snapshot.empty) {
            console.log('✅ No doctors found in Firestore to remove');
            return;
        }
        
        console.log(`📋 Found ${snapshot.size} doctor(s) to remove:`);
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`   - ${data.name} (${data.email})`);
        });
        
        // Confirm deletion
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            readline.question(`\n❓ Are you sure you want to delete ALL ${snapshot.size} doctors? This cannot be undone! (y/N): `, resolve);
        });
        readline.close();
        
        if (answer.toLowerCase() !== 'y') {
            console.log('❌ Operation cancelled');
            return;
        }
        
        console.log('\n🧹 Starting cleanup process...\n');
        
        let deleted = 0;
        let errors = 0;
        
        // Process each doctor
        for (const doc of snapshot.docs) {
            const data = doc.data();
            console.log(`Processing: ${data.name} (${data.email})`);
            
            try {
                // Delete from Firebase Auth (if userId exists)
                if (data.userId) {
                    try {
                        await admin.auth().deleteUser(data.userId);
                        console.log(`   ✅ Deleted Firebase Auth user: ${data.userId}`);
                    } catch (authError) {
                        if (authError.code === 'auth/user-not-found') {
                            console.log(`   ⚠️  Firebase Auth user already deleted: ${data.userId}`);
                        } else {
                            throw authError;
                        }
                    }
                } else {
                    // Try to find by email if no userId
                    try {
                        const userRecord = await admin.auth().getUserByEmail(data.email);
                        await admin.auth().deleteUser(userRecord.uid);
                        console.log(`   ✅ Found and deleted Firebase Auth user by email: ${userRecord.uid}`);
                    } catch (authError) {
                        if (authError.code === 'auth/user-not-found') {
                            console.log(`   ⚠️  No Firebase Auth user found for email: ${data.email}`);
                        } else {
                            console.log(`   ⚠️  Auth cleanup error: ${authError.message}`);
                        }
                    }
                }
                
                // Delete from users collection
                if (data.userId) {
                    try {
                        await db.collection('users').doc(data.userId).delete();
                        console.log(`   ✅ Deleted user profile: ${data.userId}`);
                    } catch (userError) {
                        console.log(`   ⚠️  User profile cleanup: ${userError.message}`);
                    }
                }
                
                // Delete doctor profile from Firestore
                await doc.ref.delete();
                console.log(`   ✅ Deleted doctor profile: ${doc.id}`);
                
                deleted++;
                console.log(`   ✅ Complete cleanup for: ${data.name}\n`);
                
            } catch (error) {
                console.error(`   ❌ Error cleaning up ${data.name}: ${error.message}\n`);
                errors++;
            }
        }
        
        console.log('🏁 Cleanup Summary:');
        console.log(`   ✅ Successfully deleted: ${deleted} doctors`);
        console.log(`   ❌ Errors: ${errors}`);
        console.log('\n✨ All doctors have been removed. You can now create fresh doctor accounts!');
        
    } catch (error) {
        console.error('❌ Error during bulk cleanup:', error.message);
    }
}

// Bulk delete Firebase Auth users with exceptions
async function cleanupAuthUsers(keepEmails = []) {
    try {
        console.log('🔐 Starting bulk Firebase Auth cleanup...\n');
        
        const listUsersResult = await admin.auth().listUsers(1000);
        
        if (listUsersResult.users.length === 0) {
            console.log('✅ No users found in Firebase Authentication');
            return;
        }
        
        // Filter users to delete (exclude the ones to keep)
        const usersToDelete = listUsersResult.users.filter(user => {
            if (!user.email) {
                return true; // Delete users without email
            }
            return !keepEmails.includes(user.email.toLowerCase());
        });
        
        const usersToKeep = listUsersResult.users.filter(user => {
            if (!user.email) {
                return false;
            }
            return keepEmails.includes(user.email.toLowerCase());
        });
        
        console.log(`📊 Firebase Auth Users Summary:`);
        console.log(`   Total users: ${listUsersResult.users.length}`);
        console.log(`   Users to keep: ${usersToKeep.length}`);
        console.log(`   Users to delete: ${usersToDelete.length}\n`);
        
        if (usersToKeep.length > 0) {
            console.log('✅ Users to KEEP:');
            usersToKeep.forEach(user => {
                console.log(`   - ${user.email} (${user.uid})`);
            });
            console.log();
        }
        
        if (usersToDelete.length === 0) {
            console.log('✅ No users to delete');
            return;
        }
        
        console.log('🗑️  Users to DELETE:');
        usersToDelete.forEach(user => {
            console.log(`   - ${user.email || 'No email'} (${user.uid})`);
        });
        
        // Confirm deletion
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            readline.question(`\n❓ Are you sure you want to delete ${usersToDelete.length} Firebase Auth users? (y/N): `, resolve);
        });
        readline.close();
        
        if (answer.toLowerCase() !== 'y') {
            console.log('❌ Operation cancelled');
            return;
        }
        
        console.log('\n🧹 Starting Firebase Auth cleanup...\n');
        
        let deleted = 0;
        let errors = 0;
        
        // Delete users one by one
        for (const user of usersToDelete) {
            try {
                console.log(`Deleting: ${user.email || 'No email'} (${user.uid})`);
                
                // Delete from Firebase Auth
                await admin.auth().deleteUser(user.uid);
                
                // Also clean up any related Firestore documents
                try {
                    // Delete from users collection
                    await db.collection('users').doc(user.uid).delete();
                    console.log(`   🧹 Cleaned up user profile: ${user.uid}`);
                } catch (firestoreError) {
                    // Ignore if document doesn't exist
                    if (firestoreError.code !== 5) { // NOT_FOUND error code
                        console.log(`   ⚠️  Firestore cleanup: ${firestoreError.message}`);
                    }
                }
                
                console.log(`   ✅ Successfully deleted\n`);
                deleted++;
                
            } catch (error) {
                console.error(`   ❌ Error deleting ${user.uid}: ${error.message}\n`);
                errors++;
            }
        }
        
        console.log('🏁 Auth Cleanup Summary:');
        console.log(`   ✅ Successfully deleted: ${deleted} users`);
        console.log(`   ❌ Errors: ${errors}`);
        console.log(`   ✅ Kept safe: ${usersToKeep.length} users\n`);
        
        console.log('✨ Firebase Auth cleanup complete! Remaining users are:');
        const finalUsers = await admin.auth().listUsers(1000);
        finalUsers.users.forEach(user => {
            console.log(`   - ${user.email || 'No email'} (${user.uid})`);
        });
        
    } catch (error) {
        console.error('❌ Error during Firebase Auth cleanup:', error.message);
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('🏥 MedConnect Doctor Management Tool');
        console.log('=====================================\n');
        console.log('Usage:');
        console.log('  node manage-doctors.js add "Dr. Name" "email@example.com" "Specialty"');
        console.log('  node manage-doctors.js list');
        console.log('  node manage-doctors.js list-auth');
        console.log('  node manage-doctors.js delete "email@example.com"');
        console.log('  node manage-doctors.js delete-auth "email@example.com"');
        console.log('  node manage-doctors.js delete-confirm "email@example.com" "userId"');
        console.log('  node manage-doctors.js remove-all');
        console.log('  node manage-doctors.js cleanup-auth');
        console.log('\nExamples:');
        console.log('  node manage-doctors.js add "د. أحمد حسن" "ahmed@hospital.com" "طب الأطفال"');
        console.log('  node manage-doctors.js list');
        console.log('  node manage-doctors.js delete "ahmed@hospital.com"');
        return;
    }
    
    const command = args[0];
    
    try {
        switch (command) {
            case 'add':
                if (args.length < 4) {
                    console.log('❌ Missing required arguments');
                    console.log('Usage: node manage-doctors.js add "Dr. Name" "email@example.com" "Specialty"');
                    return;
                }
                await createDoctor(args[1], args[2], args[3]);
                break;
                
            case 'list':
                await listDoctors();
                break;
                
            case 'list-auth':
                await listAuthUsers();
                break;
                
            case 'delete':
                if (args.length < 2) {
                    console.log('❌ Missing email argument');
                    console.log('Usage: node manage-doctors.js delete "email@example.com"');
                    return;
                }
                await deleteDoctor(args[1]);
                break;
                
            case 'delete-auth':
                if (args.length < 2) {
                    console.log('❌ Missing email argument');
                    console.log('Usage: node manage-doctors.js delete-auth "email@example.com"');
                    return;
                }
                await deleteAuthUser(args[1]);
                break;
                
            case 'delete-confirm':
                if (args.length < 3) {
                    console.log('❌ Missing arguments');
                    console.log('Usage: node manage-doctors.js delete-confirm "email@example.com" "userId"');
                    return;
                }
                await confirmDelete(args[1], args[2]);
                break;
                
            case 'remove-all':
                await removeAllDoctors();
                break;
                
            case 'cleanup-auth':
                // Keep only these two emails, delete everything else
                await cleanupAuthUsers(['obaidaalluhebe@gmail.com', 'dr.abdanoo@gmail.com']);
                break;
                
            default:
                console.log('❌ Unknown command:', command);
                console.log('Available commands: add, list, list-auth, delete, delete-auth, delete-confirm, remove-all, cleanup-auth');
        }
    } catch (error) {
        console.error('\n💥 Command failed:', error.message);
        process.exit(1);
    }
}

// Run the CLI
if (require.main === module) {
    main().then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error('💥 Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = { createDoctor, listDoctors, deleteDoctor };