// Role-based authentication and routing
import { auth } from './firebase.js';

// Check authentication and redirect if needed
export function checkAuthAndRedirect() {
    const currentPath = window.location.pathname;
    
    // Protected routes
    const protectedRoutes = {
        '/doctor.html': 'doctor',
        '/admin.html': 'admin'
    };
    
    auth.onAuthStateChanged(user => {
        const requiredRole = protectedRoutes[currentPath];
        
        if (requiredRole && !user) {
            // Redirect to login if accessing protected route without auth
            window.location.href = '/index.html';
            return;
        }
        
        if (user && currentPath === '/index.html') {
            // User is logged in on public page - show dashboard
            showPatientDashboard();
        }
    });
}

function showPatientDashboard() {
    // Hide public sections
    const heroSection = document.querySelector('.hero-gradient').parentElement;
    const specialtiesSection = heroSection.nextElementSibling;
    const featuredSection = specialtiesSection.nextElementSibling;
    
    if (heroSection) heroSection.style.display = 'none';
    if (specialtiesSection) specialtiesSection.style.display = 'none';
    if (featuredSection) featuredSection.style.display = 'none';
    
    // Show patient dashboard
    const dashboard = document.getElementById('patientDashboard');
    if (dashboard) {
        dashboard.classList.remove('hidden');
        dashboard.style.display = 'block';
    }
    
    // Update navigation
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    
    if (signInBtn) signInBtn.classList.add('hidden');
    if (signOutBtn) signOutBtn.classList.remove('hidden');
    
    // Update patient name
    const patientNameBtn = document.getElementById('patientNameBtn');
    if (patientNameBtn && auth.currentUser) {
        patientNameBtn.textContent = auth.currentUser.phoneNumber || 'مريض';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', checkAuthAndRedirect);