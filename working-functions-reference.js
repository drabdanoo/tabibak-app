// Key working JavaScript functions from patient-canvas-working.html

// Simple Firebase initialization
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Simple reCAPTCHA setup
let recaptchaVerifier = null;

function initializeRecaptcha() {
    if (!recaptchaVerifier) {
        recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible'
        }, auth);
    }
    return recaptchaVerifier;
}

// Working phone verification (register)
async function handleRegister(event) {
    // ... validation code ...
    
    try {
        const tempUser = { name, phone, password };
        localStorage.setItem('medconnect_temp_user', JSON.stringify(tempUser));
        
        const internationalPhone = '+964' + phone.substring(1);
        const appVerifier = initializeRecaptcha();
        
        showNotification('جاري إرسال رمز التحقق...', 'info');
        confirmationResult = await auth.signInWithPhoneNumber(internationalPhone, appVerifier);
        
        console.log('SMS sent successfully');
        // ... rest of success handling
    } catch (error) {
        // ... error handling
    }
}

// Working Firestore operations
await db.collection('users').doc(user.uid).set({
    name: tempUser.name,
    phone: tempUser.phone,
    verified: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    uid: user.uid
});

await db.collection('appointments').add(appointmentData);