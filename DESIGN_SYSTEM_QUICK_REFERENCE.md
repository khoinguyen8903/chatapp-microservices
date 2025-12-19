# Premium Messaging UI - Design System Quick Reference

## 🎨 Color Palette

### Primary Colors
```css
--primary-indigo: #6366f1;
--primary-purple: #8b5cf6;
--primary-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
```

### Backgrounds
```css
--bg-white: #ffffff;
--bg-soft-white: #f9fafb;
--bg-light-gray: #f3f4f6;
--bg-gradient: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
```

### Text Colors
```css
--text-dark: #1f2937;
--text-medium: #6b7280;
--text-light: #9ca3af;
```

### Status Colors
```css
--status-online: #10b981;
--status-offline: #94a3b8;
--status-error: #ef4444;
--status-warning: #f59e0b;
```

---

## 📐 Spacing Scale

```css
xs:  0.5rem  (8px)
sm:  0.75rem (12px)
md:  1rem    (16px)
lg:  1.5rem  (24px)
xl:  2rem    (32px)
2xl: 3rem    (48px)
```

---

## 🔤 Typography

### Font Family
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Font Weights
```css
Light:      300
Regular:    400
Medium:     500
Semibold:   600
Bold:       700
Extrabold:  800
```

### Font Sizes
```css
xs:   0.6875rem (11px)
sm:   0.8125rem (13px)
base: 0.9375rem (15px)
md:   1rem      (16px)
lg:   1.125rem  (18px)
xl:   1.25rem   (20px)
2xl:  1.5rem    (24px)
```

---

## 🔘 Border Radius

```css
sm:   8px
md:   12px
lg:   16px
xl:   20px
2xl:  24px
full: 9999px (circular)
```

---

## 🌑 Shadows

### Light Shadows
```css
shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.04);
shadow-md: 0 4px 16px rgba(0, 0, 0, 0.06);
shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08);
```

### Colored Shadows
```css
shadow-indigo: 0 4px 16px rgba(99, 102, 241, 0.25);
shadow-green: 0 4px 16px rgba(16, 185, 129, 0.25);
shadow-red: 0 4px 16px rgba(239, 68, 68, 0.25);
```

---

## ✨ Glassmorphism

```css
background: rgba(255, 255, 255, 0.85);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.3);
```

---

## 🎬 Animation Timings

### Durations
```css
fast:   150ms
normal: 250ms
slow:   350ms
slower: 500ms
```

### Easing Functions
```css
ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
ease-out: cubic-bezier(0, 0, 0.2, 1);
ease-in: cubic-bezier(0.4, 0, 1, 1);
```

---

## 📱 Breakpoints

```css
Mobile:  < 768px
Tablet:  768px - 1023px
Desktop: ≥ 1024px
```

### Media Query Usage
```scss
// Mobile First (default styles)
.element { ... }

// Tablet and up
@media (min-width: 768px) { ... }

// Desktop and up
@media (min-width: 1024px) { ... }
```

---

## 🎯 Component Patterns

### Message Bubble (Sent)
```scss
padding: 1rem 1.25rem;
background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
color: white;
border-radius: 20px;
border-bottom-right-radius: 4px;
box-shadow: 0 4px 16px rgba(99, 102, 241, 0.25);
```

### Message Bubble (Received)
```scss
padding: 1rem 1.25rem;
background: white;
color: #1f2937;
border: 1px solid rgba(226, 232, 240, 0.8);
border-radius: 20px;
border-bottom-left-radius: 4px;
box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
```

### Avatar (Private)
```scss
width: 48px;
height: 48px;
border-radius: 50%;
background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
color: white;
border: 3px solid white;
box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
```

### Avatar (Group)
```scss
width: 48px;
height: 48px;
border-radius: 50%;
background: linear-gradient(135deg, #f59e0b 0%, #dc2626 100%);
color: white;
border: 3px solid white;
box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
```

### Online Status Indicator
```scss
width: 14px;
height: 14px;
border-radius: 50%;
background: #10b981;
border: 3px solid white;
box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
animation: pulse-status 2s infinite;
```

### Button (Primary)
```scss
height: 42px;
padding: 0 1.5rem;
background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
color: white;
border-radius: 12px;
font-weight: 600;
box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
transition: all 0.25s ease;

&:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
}
```

### Input Field
```scss
padding: 0.875rem 1rem;
background: white;
border: 2px solid transparent;
border-radius: 16px;
font-size: 0.875rem;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
transition: all 0.25s ease;

&:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
}
```

---

## 🎨 Gradient Combinations

### Primary (Indigo to Purple)
```css
background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
```

### Warm (Orange to Red)
```css
background: linear-gradient(135deg, #f59e0b 0%, #dc2626 100%);
```

### Cool (Blue to Cyan)
```css
background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%);
```

### Soft (White to Gray)
```css
background: linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%);
```

---

## ♿ Accessibility Standards

### Color Contrast
- Text on Primary: ≥ 4.5:1 (WCAG AA)
- Large Text: ≥ 3:1
- UI Components: ≥ 3:1

### Touch Targets
- Minimum: 42px × 42px
- Recommended: 48px × 48px

### Focus States
```css
outline: 2px solid #6366f1;
outline-offset: 2px;
border-radius: 4px;
```

---

## 🔄 State Variations

### Hover
```css
transform: scale(1.05) translateY(-1px);
box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
```

### Active (Click)
```css
transform: scale(0.95);
```

### Disabled
```css
opacity: 0.5;
cursor: not-allowed;
pointer-events: none;
```

### Loading
```css
opacity: 0.6;
cursor: wait;
pointer-events: none;
```

---

## 📊 Z-Index Scale

```css
z-base:    0
z-dropdown: 10
z-sticky:   20
z-fixed:    30
z-modal:    50
z-popover:  60
z-tooltip:  70
z-toast:    80
z-max:      9999
```

---

## 🎭 Common Animations

### Fade In
```scss
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
animation: fadeIn 0.4s ease-out;
```

### Slide Up
```scss
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
animation: slideUp 0.4s ease-out;
```

### Pulse
```scss
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
animation: pulse 2s infinite;
```

### Bounce
```scss
@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-8px); }
}
animation: bounce 1.4s infinite ease-in-out;
```

---

## 🛠️ Utility Classes

```css
.text-truncate          /* Ellipsis overflow */
.glassmorphism          /* Glassmorphism effect */
.animate-fade-in        /* Fade in animation */
.animate-slide-up       /* Slide up animation */
.no-select              /* Disable text selection */
.loading                /* Loading state */
.hidden                 /* Display none */
.visually-hidden        /* Screen reader only */
```

---

## 📝 CSS Variables Usage

```scss
// Define in :root
:root {
  --primary: #6366f1;
  --radius: 16px;
}

// Use in components
.button {
  background: var(--primary);
  border-radius: var(--radius);
}
```

---

## 🚀 Performance Tips

1. Use `transform` and `opacity` for animations
2. Avoid animating `width`, `height`, `left`, `right`
3. Use `will-change` sparingly
4. Debounce scroll events
5. Lazy load images
6. Use CSS containment where appropriate

---

**Last Updated**: December 19, 2025  
**Version**: 2.0.0
