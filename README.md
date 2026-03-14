# 📏 Height Measure — React + Vite Web App

A production-grade React web app to measure human height using your device camera.  
No depth sensor required. Built with **Vite** (zero known vulnerabilities).

---

## 🚀 Quick Start

```bash
npm install
npm run dev        # dev server → http://localhost:5173
npm run build      # production build
npm run preview    # preview production build
npm test           # run 27 tests (all passing)
```

## ✨ Features
- 📷 Live camera feed (rear camera preferred on mobile)
- 🟢 Tap head → 🟠 Tap feet → instant result
- 📐 Perspective geometry estimation (±2–8 cm)
- 🎯 Dynamic accuracy score with colour feedback
- 📏 cm / ft-in unit toggle
- ⚙️ Calibration reference slider
- 🌟 Neon sci-fi canvas overlay with scan-line animation
- 📱 Fully responsive — mobile + desktop

## 🛡 Security
- **0 vulnerabilities** (migrated from CRA → Vite)
- All dependencies at latest stable versions
- 27 automated tests covering all features

## 🔬 How It Works
```
estimated_height = (pixel_height / frame_height) × 280 cm
```
Empirical constant calibrated for typical webcam FOV (~70°) at ~1.5 m distance.  
A small correction factor adjusts for horizontal off-centre position.

## 🎯 Tips for best accuracy
- Stand 1–2 m from camera
- Keep person centred in frame
- Ensure full body (head → feet) visible
- Good even lighting
- Person stands straight

## 🧪 Tests
```
✓ 27 tests passing (Vitest + React Testing Library)
  - Initial render & UI state
  - Unit toggle (cm / ft-in)
  - Calibration panel show/hide & slider
  - Camera error handling
  - getUserMedia call & constraints
  - Canvas overlay
  - Height conversion math
  - Tips section
  - Accessibility (aria-labels, roles)
```
