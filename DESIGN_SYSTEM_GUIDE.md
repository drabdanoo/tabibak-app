# Digital Health Iraq - Design System Usage Guide

## Quick Start: Apply Theme to Any Page

To make any page (patient.html, doctor.html, receptionist.html) use the same "Digital Health Iraq" theme, follow these steps:

### 1. Add Required Files to `<head>`

```html
<head>
    <!-- Existing meta tags -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Cairo Font -->
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    
    <!-- Built CSS (includes all DHI components) -->
    <link rel="stylesheet" href="styles.css">
    
    <!-- Your page-specific styles (if any) -->
    <style>
        body {
            font-family: 'Cairo', sans-serif;
        }
    </style>
</head>
```

### 2. Add Shared Effects Script Before `</body>`

```html
<!-- Your page content -->

<!-- Shared Interactive Effects -->
<script src="dhi-effects.js"></script>

<!-- Your page-specific scripts -->
<script src="your-page.js"></script>
</body>
```

---

## Available Component Classes

### Navigation
```html
<!-- Floating Glass Navigation -->
<nav class="dhi-nav">
    <div class="flex justify-between items-center">
        <div class="flex items-center">
            <div class="dhi-nav-brand">
                <!-- Your logo SVG -->
            </div>
            <div>
                <h1 class="dhi-nav-title">Your Title</h1>
                <p class="text-xs text-gray-500 font-semibold">Subtitle</p>
            </div>
        </div>
        <div class="flex items-center space-x-6 space-x-reverse">
            <a href="#section1" class="dhi-nav-link">Link 1</a>
            <a href="#section2" class="dhi-nav-link">Link 2</a>
        </div>
    </div>
</nav>
```

### Hero Section
```html
<section class="dhi-hero">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div class="reveal-up">
            <span class="dhi-hero-badge">New Version Available</span>
            <h1 class="dhi-hero-title">Your Main Heading</h1>
            <p class="dhi-hero-subtitle">Your subtitle here</p>
            <p class="dhi-hero-description">
                Longer description text goes here
            </p>
            
            <div class="flex justify-center space-x-6 space-x-reverse">
                <button class="dhi-btn-primary">Primary Action</button>
                <button class="dhi-btn-secondary">Secondary Action</button>
            </div>
        </div>
    </div>
</section>
```

### Content Cards
```html
<div class="dhi-card">
    <div class="dhi-card-icon">
        <!-- Icon SVG -->
    </div>
    <h3 class="dhi-card-title">Card Title</h3>
    <p class="dhi-card-description">Card description text</p>
    <ul class="text-sm text-gray-600 mb-10 space-y-3 font-medium">
        <li class="flex items-center justify-center">
            <svg class="w-5 h-5 text-indigo-600 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
            </svg>
            Feature item
        </li>
    </ul>
    <button class="dhi-btn-green">Action Button</button>
</div>
```

### Sections
```html
<!-- Light Section -->
<section class="dhi-section-light">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="dhi-section-header">
            <h2 class="dhi-section-title">Section Title</h2>
            <p class="dhi-section-subtitle">Section subtitle</p>
        </div>
        
        <!-- Your content grid -->
        <div class="grid md:grid-cols-3 gap-10">
            <!-- Cards or other content -->
        </div>
    </div>
</section>

<!-- Dark Section -->
<section class="dhi-section-dark">
    <!-- Same structure as light section -->
</section>

<!-- White Section -->
<section class="dhi-section-white">
    <!-- Same structure as light section -->
</section>
```

### Feature Cards (for dark sections)
```html
<div class="dhi-feature-card">
    <div class="dhi-feature-icon">
        <!-- Icon SVG -->
    </div>
    <h3 class="dhi-feature-title">Feature Title</h3>
    <p class="dhi-feature-description">Feature description</p>
</div>
```

### Stats
```html
<div class="dhi-stat-card">
    <div class="dhi-stat-value">1000+</div>
    <div class="dhi-stat-label">Label Text</div>
</div>
```

### Forms
```html
<form>
    <div class="mb-6">
        <label class="dhi-label">Field Label</label>
        <input type="text" class="dhi-input" placeholder="Placeholder text">
    </div>
    <button type="submit" class="dhi-btn-primary w-full">Submit</button>
</form>
```

### Badges
```html
<span class="dhi-badge">Live</span>
<span class="badge-pulse bg-indigo-600 text-white px-4 py-1 rounded-xl font-bold text-xs">Custom Badge</span>
```

---

## Color Palette

Use these Tailwind classes for consistent coloring:

- **Primary**: `bg-indigo-600`, `text-indigo-600` (#6366f1)
- **Success**: `bg-green-600`, `text-green-600` (#16a34a)
- **Warning**: `bg-orange-600`, `text-orange-600` (#ea580c)
- **Dark Surface**: `bg-slate-950`, `text-slate-950` (#020617)
- **Light Surface**: `bg-slate-50`, `text-slate-50` (#f8fafc)

---

## Typography

- **Headers**: Use `font-black` (900 weight) with `tracking-tight`
- **Body**: Use `font-medium` (500) or `font-semibold` (600)
- **Size**: Use standard Tailwind sizes (`text-xl`, `text-2xl`, etc.)

---

## Border Radius

- **Cards**: `rounded-[3rem]` (already in dhi-card)
- **Sections**: `rounded-[5rem]`
- **Buttons**: `rounded-2xl` or `rounded-3xl` (already in button classes)
- **Small elements**: `rounded-xl` or `rounded-2xl`

---

## Interactive Effects

All effects are automatic when you include `dhi-effects.js`:

1. **Scroll Reveal**: Add `reveal-up`, `reveal-left`, or `reveal-right` classes
2. **3D Tilt**: Automatically applied to `.dhi-card` and `.dhi-feature-card`
3. **Spotlight**: Automatically applied to elements with `.spotlight` class

---

## Example: Converting Patient.html Header

**Before:**
```html
<header class="bg-white shadow-lg border-b-4 border-blue-500">
    <div class="max-w-7xl mx-auto px-4">
        <h1 class="text-3xl font-bold">Patient Portal</h1>
    </div>
</header>
```

**After:**
```html
<nav class="dhi-nav">
    <div class="flex justify-between items-center">
        <div class="flex items-center">
            <div class="dhi-nav-brand">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <!-- Patient icon -->
                </svg>
            </div>
            <div>
                <h1 class="dhi-nav-title">بوابة المرضى</h1>
                <p class="text-xs text-gray-500 font-semibold">Patient Portal</p>
            </div>
        </div>
        <div class="flex items-center space-x-6 space-x-reverse">
            <a href="#appointments" class="dhi-nav-link">مواعيدي</a>
            <a href="#profile" class="dhi-nav-link">الملف الشخصي</a>
        </div>
    </div>
</nav>
```

---

## Migration Checklist

For each page (patient.html, doctor.html, receptionist.html):

- [ ] Add Cairo font with weights 400, 500, 600, 700, 900
- [ ] Include `styles.css` (already built with DHI components)
- [ ] Include `dhi-effects.js` before closing `</body>` tag
- [ ] Replace navigation with `.dhi-nav` structure
- [ ] Update buttons to use `.dhi-btn-primary`, `.dhi-btn-green`, or `.dhi-btn-orange`
- [ ] Update cards to use `.dhi-card` class
- [ ] Update forms to use `.dhi-input` and `.dhi-label`
- [ ] Add `reveal-up` classes to sections for scroll animations
- [ ] Test all interactive effects work properly

---

## Need Help?

Refer to [`index.html`](./public/index.html) for a complete working example of all components.

All component classes are defined in:
- [`public/src/tailwind.css`](./public/src/tailwind.css) - Component definitions
- [`public/dhi-effects.js`](./public/dhi-effects.js) - Interactive effects
