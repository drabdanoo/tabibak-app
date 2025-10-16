const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

// Keep these accounts safe
const KEEP_EMAILS = [
    'obaidaalluhebe@gmail.com',
    'vipsnapchat69@gmail.com', // Dr. John Smith
    'dr.abdanoo@gmail.com'
];

async function cleanupUnwantedDoctors() {
    try {
        console.log('🧹 Starting selective cleanup...');
        console.log('✅ Keeping these accounts safe:');
        KEEP_EMAILS.forEach(email => console.log(`   - ${email}`));
        console.log();
        
        // Get all doctors from Firestore
        const snapshot = await db.collection('doctors').get();
        
        if (snapshot.empty) {
            console.log('✅ No doctors found in Firestore');
            return;
        }
        
        console.log(`📋 Found ${snapshot.size} doctor(s) in Firestore:`);
        
        let toDelete = [];
        let toKeep = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const email = data.email?.toLowerCase();
            
            if (KEEP_EMAILS.map(e => e.toLowerCase()).includes(email)) {
                toKeep.push({ id: doc.id, name: data.name, email: data.email });
            } else {
                toDelete.push({ id: doc.id, name: data.name, email: data.email, userId: data.userId });
            }
        });
        
        console.log(`\n✅ Doctors to KEEP (${toKeep.length}):`);
        toKeep.forEach(doc => console.log(`   - ${doc.name} (${doc.email})`));
        
        console.log(`\n🗑️ Doctors to DELETE (${toDelete.length}):`);
        toDelete.forEach(doc => console.log(`   - ${doc.name} (${doc.email})`));
        
        if (toDelete.length === 0) {
            console.log('\n✅ No doctors to delete!');
            return;
        }
        
        // Confirm deletion
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            readline.question(`\n❓ Delete ${toDelete.length} unwanted doctors? (y/N): `, resolve);
        });
        readline.close();
        
        if (answer.toLowerCase() !== 'y') {
            console.log('❌ Operation cancelled');
            return;
        }
        
        console.log('\n🧹 Starting cleanup...\n');
        
        let deletedDocs = 0;
        let deletedAuth = 0;
        let errors = 0;
        
        for (const doc of toDelete) {
            try {
                console.log(`Processing: ${doc.name} (${doc.email})`);
                
                // Delete from Firestore
                await db.collection('doctors').doc(doc.id).delete();
                console.log(`   ✅ Deleted from Firestore: ${doc.id}`);
                deletedDocs++;
                
                // Delete from Firebase Auth (if userId exists)
                if (doc.userId) {
                    try {
                        await auth.deleteUser(doc.userId);
                        console.log(`   ✅ Deleted from Firebase Auth: ${doc.userId}`);
                        deletedAuth++;
                    } catch (authError) {
                        if (authError.code === 'auth/user-not-found') {
                            console.log(`   ⚠️ Auth user already deleted: ${doc.userId}`);
                        } else {
                            console.log(`   ⚠️ Auth delete error: ${authError.message}`);
                        }
                    }
                }
                
                // Clean up users collection
                if (doc.userId) {
                    try {
                        await db.collection('users').doc(doc.userId).delete();
                        console.log(`   ✅ Cleaned up user profile: ${doc.userId}`);
                    } catch (userError) {
                        console.log(`   ⚠️ User cleanup: ${userError.message}`);
                    }
                }
                
                console.log(`   ✅ Complete cleanup for: ${doc.name}\n`);
                
            } catch (error) {
                console.error(`   ❌ Error cleaning up ${doc.name}: ${error.message}\n`);
                errors++;
            }
        }
        
        console.log('🏁 Cleanup Summary:');
        console.log(`   ✅ Firestore docs deleted: ${deletedDocs}`);
        console.log(`   ✅ Firebase Auth users deleted: ${deletedAuth}`);
        console.log(`   ❌ Errors: ${errors}`);
        console.log(`   ✅ Safe accounts kept: ${toKeep.length}`);
        
        console.log('\n✨ Selective cleanup complete!');
        
        // Verify remaining doctors
        console.log('\n📋 Remaining doctors in Firestore:');
        const remainingSnapshot = await db.collection('doctors').get();
        if (remainingSnapshot.empty) {
            console.log('   (None)');
        } else {
            remainingSnapshot.forEach(doc => {
                const data = doc.data();
                console.log(`   - ${data.name} (${data.email})`);
            });
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('💥 Fatal error:', error.message);
        process.exit(1);
    }
}

cleanupUnwantedDoctors();