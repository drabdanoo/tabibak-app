/**
 * Digital Health Iraq - Shared Interactive Effects
 * Include this script in any page to enable:
 * - Scroll reveal animations
 * - 3D tilt effects on cards
 * - Spotlight hover effects
 */

(function() {
    'use strict';

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        initScrollReveal();
        initTiltEffect();
        initSpotlightEffect();
    });

    /**
     * Initialize scroll reveal animations using IntersectionObserver
     */
    function initScrollReveal() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                }
            });
        }, observerOptions);

        // Observe all reveal elements
        document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right, .dhi-section-header').forEach(el => {
            observer.observe(el);
        });
    }

    /**
     * Initialize 3D tilt effect on cards
     */
    function initTiltEffect() {
        document.querySelectorAll('.tilt-card, .dhi-card, .dhi-feature-card').forEach(card => {
            card.addEventListener('mousemove', handleTiltMove);
            card.addEventListener('mouseleave', handleTiltLeave);
        });
    }

    function handleTiltMove(e) {
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    }

    function handleTiltLeave(e) {
        e.currentTarget.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    }

    /**
     * Initialize spotlight effect
     */
    function initSpotlightEffect() {
        document.querySelectorAll('.spotlight').forEach(spotlight => {
            spotlight.addEventListener('mousemove', handleSpotlightMove);
        });

        document.querySelectorAll('.spotlight-section').forEach(section => {
            section.addEventListener('mousemove', handleSpotlightMove);
        });
    }

    function handleSpotlightMove(e) {
        const element = e.currentTarget;
        const rect = element.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        element.style.setProperty('--x', `${x}%`);
        element.style.setProperty('--y', `${y}%`);
    }

    /**
     * Utility: Smooth scroll for anchor links
     */
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    // Initialize smooth scroll if needed
    if (document.querySelectorAll('a[href^="#"]').length > 0) {
        initSmoothScroll();
    }

})();
