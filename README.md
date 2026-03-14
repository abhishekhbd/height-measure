# 📏 Height Measure — React Web App

A production-grade React.js web app that uses your device camera to measure human height with no depth sensor required.

## 🚀 Live Demo
Open in any modern browser on desktop or mobile.

## ✨ Features
- 📷 Live camera feed (rear camera preferred on mobile)
- 👆 Tap head & feet to measure
- 📐 Perspective geometry math for estimation
- 🎯 Dynamic accuracy score (60–95%)
- 📏 cm / ft-in unit toggle
- ⚙️ Calibration reference slider
- 🌟 Neon sci-fi UI with canvas overlay
- 📳 Animated scan line + ripple tap effects
- 📱 Fully responsive (mobile + desktop)

## 🛠 Setup

```bash
npm install
npm start        # dev server at localhost:3000
npm run build    # production build
```

## 🔬 How It Works
Uses perspective projection: `H = (pixel_height / frame_height) × 290cm`
with empirical correction for typical webcam FOV (~70°) at ~1.5m distance.

## 🎯 Accuracy Tips
- Stand 1–2m from camera
- Keep person centered in frame
- Ensure full body (head to feet) is visible
- Good even lighting
- Expected accuracy: ±2–8 cm
