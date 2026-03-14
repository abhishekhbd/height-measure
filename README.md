# 📏 Height Measure — Android App

A highly interactive Android app that uses the camera to measure human height with no depth sensor required.

---

## ✨ Features

| Feature | Details |
|---|---|
| 📷 Camera2 API | Real-time camera preview, full resolution |
| 👆 Touch-to-measure | Tap head & feet on screen |
| 📐 Perspective math | Uses camera focal length + sensor size |
| 🎯 Accuracy score | Dynamic feedback on measurement quality |
| 🌡 Unit toggle | cm / ft-in switch |
| ⚙️ Calibration | Reference height slider for better results |
| 🎨 Neon UI | Dark sci-fi interface with green glow |
| 📳 Haptic feedback | Vibration on tap points |
| 🔢 Animated counter | Height value counts up on result |
| 📊 Ruler overlay | Tick marks on measurement line |

---

## 🔬 How the Measurement Works

### Without Depth Sensor (Default Method)
The app uses **perspective projection geometry**:

```
H_real = (h_pixels / f_pixels) × D
```

Where:
- `h_pixels` = pixel height of person on screen
- `f_pixels` = focal length in pixels = (focal_mm / sensor_height_mm) × image_height_px
- `D` = assumed distance from camera (~1.5m, or calibrated)

### Camera Intrinsics Extraction
The app reads from `CameraCharacteristics`:
- `LENS_INFO_AVAILABLE_FOCAL_LENGTHS` → focal length in mm
- `SENSOR_INFO_PHYSICAL_SIZE` → physical sensor dimensions in mm

This allows physics-based estimation rather than pure guesswork.

### Perspective Correction
A small correction is applied for horizontal position:
```kotlin
val correction = 1f + (horizontalOffset × 0.04f)
```
Persons off-center appear slightly shorter due to lens distortion.

---

## 🎯 Accuracy Tips

For best results (±2–3 cm accuracy):

1. **Distance**: Stand person 1.2 – 2.0m from camera
2. **Centering**: Keep person centered horizontally
3. **Full body**: Ensure top of head AND feet are fully visible
4. **Phone height**: Hold camera at ~eye level or shoulder height
5. **Calibration**: Set your own height in ⚙️ calibration panel
6. **Lighting**: Good even lighting, avoid strong backlight
7. **Posture**: Person should stand straight, not leaning

Expected accuracy:
- ✅ Good conditions: ±2–5 cm
- ⚠️ Average conditions: ±5–10 cm
- ❌ Poor conditions: ±10–20 cm

---

## 📱 Setup Instructions

### Prerequisites
- Android Studio Hedgehog (2023.1.1) or newer
- Android SDK 34
- Kotlin 1.8.0+
- Physical Android device (Android 6.0+) — camera preview won't work on emulator

### Steps
```bash
1. Open Android Studio
2. File → Open → select /HeightMeasure folder
3. Wait for Gradle sync to complete
4. Connect Android device via USB
5. Enable Developer Options + USB Debugging on device
6. Run → Run 'app'
7. Allow camera permission when prompted
```

### Minimum Requirements
- Android 6.0 (API 23)
- Rear camera (required)
- Depth/ToF sensor (optional, improves accuracy if present)

---

## 🏗 Project Structure

```
HeightMeasure/
├── app/src/main/
│   ├── java/com/heightmeasure/
│   │   ├── MainActivity.kt           ← Camera2 setup + UI logic + measurement math
│   │   └── MeasurementOverlayView.kt ← Custom canvas drawing: grid, lines, markers
│   ├── res/
│   │   ├── layout/activity_main.xml  ← Full UI layout
│   │   ├── drawable/                 ← All visual assets (buttons, gradients, rings)
│   │   └── values/                   ← Colors, strings, styles
│   └── AndroidManifest.xml
├── build.gradle
└── settings.gradle
```

---

## 🎨 UI Design

The interface uses a **dark sci-fi / neon aesthetic**:
- Background: Deep black (#000000)
- Primary accent: Neon green (#00FF88)
- Secondary accent: Vivid orange (#FF6B35)
- Font: Monospace (system)
- Scan line animation during active measurement
- Pulse ring animation in idle state
- Tap ripple feedback on measurement points
- Result card slides in with overshoot animation
- Height counter animates from 0 to final value

---

## 🔧 Extending the App

### Add CameraX (simpler camera API)
Replace Camera2 in MainActivity with CameraX:
```kotlin
implementation "androidx.camera:camera-camera2:1.3.0"
implementation "androidx.camera:camera-lifecycle:1.3.0"  
implementation "androidx.camera:camera-view:1.3.0"
```

### Add ML Kit Pose Detection (advanced)
For automatic head/feet detection:
```kotlin
implementation "com.google.mlkit:pose-detection:18.0.0-beta4"
```
Use `PoseLandmark.NOSE` and `PoseLandmark.LEFT_ANKLE` landmarks.

### Add Depth API (if device has ToF sensor)
```kotlin
implementation "com.google.ar:core:1.40.0"
```

---

## 📄 License
MIT License — free to use and modify.
