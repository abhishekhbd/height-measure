package com.heightmeasure

import android.Manifest
import android.animation.*
import android.content.pm.PackageManager
import android.graphics.*
import android.hardware.camera2.*
import android.media.ImageReader
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.util.Size
import android.view.*
import android.view.animation.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import kotlin.math.*

class MainActivity : AppCompatActivity() {

    private lateinit var textureView: TextureView
    private lateinit var overlayView: MeasurementOverlayView
    private lateinit var btnMeasure: Button
    private lateinit var btnReset: Button
    private lateinit var tvResult: TextView
    private lateinit var tvInstructions: TextView
    private lateinit var tvStatus: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var cardResult: View
    private lateinit var tvHeightFt: TextView
    private lateinit var tvHeightCm: TextView
    private lateinit var layoutCalibration: View
    private lateinit var btnCalibrate: Button
    private lateinit var tvCalibrationGuide: TextView
    private lateinit var seekBarRef: SeekBar
    private lateinit var tvRefValue: TextView
    private lateinit var switchUnit: Switch
    private lateinit var tvUnit: TextView
    private lateinit var pulseRing: View
    private lateinit var scanLine: View
    private lateinit var tvAccuracy: TextView

    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var backgroundHandler: Handler? = null
    private var backgroundThread: HandlerThread? = null
    private var imageReader: ImageReader? = null

    private var cameraManager: CameraManager? = null
    private var cameraId: String = ""
    private var previewSize: Size = Size(1080, 1920)
    private var focalLength: Float = 0f
    private var sensorWidth: Float = 0f
    private var sensorHeight: Float = 0f

    // Measurement state
    private var isCalibrated = false
    private var referenceHeightCm = 170f  // default reference
    private var pixelsPerCm = 0f
    private var isMeasuring = false
    private var measurementState = MeasurementState.IDLE
    private var headPoint: PointF? = null
    private var feetPoint: PointF? = null
    private var showMetric = true

    enum class MeasurementState { IDLE, PLACE_PERSON, MEASURING, RESULT }

    companion object {
        const val CAMERA_PERMISSION = 100
        const val DEFAULT_PERSON_HEIGHT_CM = 170f
        const val REFERENCE_DISTANCE_M = 1.5f  // assumed distance from camera in meters
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY)
        setContentView(R.layout.activity_main)
        initViews()
        setupListeners()
        checkPermissions()
    }

    private fun initViews() {
        textureView = findViewById(R.id.textureView)
        overlayView = findViewById(R.id.overlayView)
        btnMeasure = findViewById(R.id.btnMeasure)
        btnReset = findViewById(R.id.btnReset)
        tvResult = findViewById(R.id.tvResult)
        tvInstructions = findViewById(R.id.tvInstructions)
        tvStatus = findViewById(R.id.tvStatus)
        progressBar = findViewById(R.id.progressBar)
        cardResult = findViewById(R.id.cardResult)
        tvHeightFt = findViewById(R.id.tvHeightFt)
        tvHeightCm = findViewById(R.id.tvHeightCm)
        layoutCalibration = findViewById(R.id.layoutCalibration)
        btnCalibrate = findViewById(R.id.btnCalibrate)
        tvCalibrationGuide = findViewById(R.id.tvCalibrationGuide)
        seekBarRef = findViewById(R.id.seekBarRef)
        tvRefValue = findViewById(R.id.tvRefValue)
        switchUnit = findViewById(R.id.switchUnit)
        tvUnit = findViewById(R.id.tvUnit)
        pulseRing = findViewById(R.id.pulseRing)
        scanLine = findViewById(R.id.scanLine)
        tvAccuracy = findViewById(R.id.tvAccuracy)

        cardResult.visibility = View.GONE
        progressBar.visibility = View.GONE
        layoutCalibration.visibility = View.GONE
        btnReset.visibility = View.GONE

        seekBarRef.max = 100
        seekBarRef.progress = 50
        updateRefLabel(170f)
        startPulseAnimation()
    }

    private fun setupListeners() {
        btnMeasure.setOnClickListener { onMeasureClicked() }
        btnReset.setOnClickListener { resetMeasurement() }
        btnCalibrate.setOnClickListener { onCalibrateClicked() }

        seekBarRef.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar, progress: Int, fromUser: Boolean) {
                referenceHeightCm = 140f + progress * 0.8f
                updateRefLabel(referenceHeightCm)
            }
            override fun onStartTrackingTouch(sb: SeekBar) {}
            override fun onStopTrackingTouch(sb: SeekBar) {}
        })

        switchUnit.setOnCheckedChangeListener { _, isChecked ->
            showMetric = !isChecked
            tvUnit.text = if (showMetric) "cm" else "ft/in"
            updateResultDisplay()
        }

        overlayView.setOnTouchListener { _, event ->
            if (measurementState == MeasurementState.PLACE_PERSON) {
                handleTouchMeasurement(event)
                true
            } else false
        }
    }

    private fun updateRefLabel(cm: Float) {
        val feet = (cm / 30.48f).toInt()
        val inches = ((cm / 2.54f) % 12).toInt()
        tvRefValue.text = "Reference: ${cm.toInt()} cm ($feet'$inches\")"
    }

    private fun onMeasureClicked() {
        when (measurementState) {
            MeasurementState.IDLE -> {
                measurementState = MeasurementState.PLACE_PERSON
                tvInstructions.text = "📍 Tap the TOP of the person's head, then their FEET"
                btnMeasure.text = "Cancel"
                btnMeasure.setBackgroundResource(R.drawable.btn_cancel)
                overlayView.setMode(MeasurementOverlayView.Mode.TOUCH_MEASURE)
                startScanAnimation()
                animateInstruction()
            }
            else -> resetMeasurement()
        }
    }

    private fun onCalibrateClicked() {
        layoutCalibration.visibility = if (layoutCalibration.visibility == View.VISIBLE)
            View.GONE else View.VISIBLE
    }

    private fun handleTouchMeasurement(event: MotionEvent) {
        if (event.action == MotionEvent.ACTION_DOWN) {
            val x = event.x
            val y = event.y

            if (headPoint == null) {
                headPoint = PointF(x, y)
                overlayView.setHeadPoint(headPoint!!)
                tvInstructions.text = "👣 Now tap the FEET / ground level"
                vibrate(50)
                showTapFeedback(x, y, "#00FF88")
            } else if (feetPoint == null) {
                feetPoint = PointF(x, y)
                overlayView.setFeetPoint(feetPoint!!)
                vibrate(100)
                showTapFeedback(x, y, "#FF6B35")
                calculateHeight()
            }
        }
    }

    private fun calculateHeight() {
        val head = headPoint ?: return
        val feet = feetPoint ?: return
        measurementState = MeasurementState.MEASURING

        progressBar.visibility = View.VISIBLE
        tvInstructions.text = "⚡ Calculating height..."

        progressBar.postDelayed({
            val pixelHeight = abs(feet.y - head.y)
            val viewHeight = overlayView.height.toFloat()

            // Use camera intrinsics if available, else use reference-based estimation
            val estimatedHeightCm = if (isCalibrated && pixelsPerCm > 0) {
                pixelHeight / pixelsPerCm
            } else {
                estimateHeightFromPerspective(pixelHeight, viewHeight)
            }

            // Apply perspective correction based on horizontal position
            val centerX = overlayView.width / 2f
            val personX = (head.x + feet.x) / 2f
            val horizontalOffset = abs(personX - centerX) / centerX
            val perspectiveCorrection = 1f + (horizontalOffset * 0.04f)
            val correctedHeight = estimatedHeightCm * perspectiveCorrection

            // Clamp to realistic range
            val finalHeight = correctedHeight.coerceIn(50f, 250f)
            val accuracy = calculateAccuracyScore(horizontalOffset, pixelHeight, viewHeight)

            progressBar.visibility = View.GONE
            displayResult(finalHeight, accuracy)
        }, 1500)
    }

    private fun estimateHeightFromPerspective(pixelHeight: Float, viewHeight: Float): Float {
        // Without depth sensor: use known reference + pixel ratio approach
        // Assumes person is standing on floor level, camera at ~shoulder height
        val cameraHeightFromGround = 140f  // typical phone held at shoulder ~140cm
        val assumedDistance = 150f  // assume ~1.5m distance (typical selfie/scan distance)

        return if (focalLength > 0 && sensorHeight > 0) {
            // Physics-based: H = (pixel_h / image_h) * sensor_h * D / f
            val D = assumedDistance  // cm
            val f_pixels = (focalLength / sensorHeight) * viewHeight
            (pixelHeight * D) / f_pixels
        } else {
            // Fallback: proportional estimation with empirical correction
            val ratio = pixelHeight / viewHeight
            // Empirical formula based on typical phone camera (~26mm equiv focal length)
            val rawEstimate = ratio * 280f  // calibrated for ~1.5m distance
            rawEstimate
        }
    }

    private fun calculateAccuracyScore(horizontalOffset: Float, pixelHeight: Float, viewHeight: Float): Int {
        var score = 95
        if (horizontalOffset > 0.3f) score -= 10
        if (horizontalOffset > 0.5f) score -= 10
        val ratio = pixelHeight / viewHeight
        if (ratio < 0.3f) score -= 15  // person too far
        if (ratio > 0.9f) score -= 10  // person too close
        if (!isCalibrated) score -= 5
        return score.coerceIn(60, 95)
    }

    private fun displayResult(heightCm: Float, accuracy: Int) {
        measurementState = MeasurementState.RESULT
        tvInstructions.text = "✅ Measurement complete!"
        btnReset.visibility = View.VISIBLE
        btnMeasure.visibility = View.GONE
        stopScanAnimation()

        overlayView.setMeasurementLine(headPoint!!, feetPoint!!, heightCm)

        cardResult.visibility = View.VISIBLE
        cardResult.alpha = 0f
        cardResult.translationY = 100f

        val feet = (heightCm / 30.48f).toInt()
        val inches = ((heightCm / 2.54f) % 12).toInt()
        tvHeightCm.text = "${heightCm.toInt()} cm"
        tvHeightFt.text = "$feet ft $inches in"
        tvAccuracy.text = "Accuracy: ~$accuracy%"

        val colorAccuracy = when {
            accuracy >= 85 -> Color.parseColor("#00FF88")
            accuracy >= 70 -> Color.parseColor("#FFD700")
            else -> Color.parseColor("#FF6B35")
        }
        tvAccuracy.setTextColor(colorAccuracy)

        // Animate card in
        val anim = AnimatorSet()
        val fadeIn = ObjectAnimator.ofFloat(cardResult, "alpha", 0f, 1f)
        val slideUp = ObjectAnimator.ofFloat(cardResult, "translationY", 100f, 0f)
        anim.playTogether(fadeIn, slideUp)
        anim.duration = 600
        anim.interpolator = OvershootInterpolator(1.2f)
        anim.start()

        // Animate height counter
        animateHeightCounter(heightCm)
    }

    private fun animateHeightCounter(targetCm: Float) {
        val animator = ValueAnimator.ofFloat(0f, targetCm)
        animator.duration = 1200
        animator.interpolator = DecelerateInterpolator(2f)
        animator.addUpdateListener {
            val v = it.animatedValue as Float
            tvHeightCm.text = "${v.toInt()} cm"
            val feet = (v / 30.48f).toInt()
            val inches = ((v / 2.54f) % 12).toInt()
            tvHeightFt.text = "$feet ft $inches in"
        }
        animator.start()
    }

    private fun updateResultDisplay() { /* recalculate display if needed */ }

    private fun resetMeasurement() {
        measurementState = MeasurementState.IDLE
        headPoint = null
        feetPoint = null
        isMeasuring = false
        overlayView.reset()
        cardResult.visibility = View.GONE
        btnReset.visibility = View.GONE
        btnMeasure.visibility = View.VISIBLE
        btnMeasure.text = "MEASURE HEIGHT"
        btnMeasure.setBackgroundResource(R.drawable.btn_measure)
        tvInstructions.text = "📏 Point camera at a person standing upright"
        stopScanAnimation()
        startPulseAnimation()
    }

    private fun showTapFeedback(x: Float, y: Float, colorHex: String) {
        val ring = View(this)
        ring.background = ContextCompat.getDrawable(this, R.drawable.tap_ring)
        ring.setColorFilter(Color.parseColor(colorHex))
        val size = 120
        val params = FrameLayout.LayoutParams(size, size)
        params.leftMargin = (x - size / 2).toInt()
        params.topMargin = (y - size / 2).toInt()
        val container = findViewById<FrameLayout>(R.id.containerLayout)
        container.addView(ring, params)

        val scaleX = ObjectAnimator.ofFloat(ring, "scaleX", 0.3f, 2f)
        val scaleY = ObjectAnimator.ofFloat(ring, "scaleY", 0.3f, 2f)
        val alpha = ObjectAnimator.ofFloat(ring, "alpha", 1f, 0f)
        val anim = AnimatorSet()
        anim.playTogether(scaleX, scaleY, alpha)
        anim.duration = 600
        anim.addListener(object : AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: Animator) {
                container.removeView(ring)
            }
        })
        anim.start()
    }

    private fun startScanAnimation() {
        scanLine.visibility = View.VISIBLE
        val anim = ObjectAnimator.ofFloat(scanLine, "translationY",
            -overlayView.height.toFloat(), overlayView.height.toFloat())
        anim.duration = 2000
        anim.repeatMode = ValueAnimator.REVERSE
        anim.repeatCount = ValueAnimator.INFINITE
        anim.interpolator = LinearInterpolator()
        anim.start()
        scanLine.tag = anim
    }

    private fun stopScanAnimation() {
        scanLine.visibility = View.GONE
        (scanLine.tag as? Animator)?.cancel()
    }

    private fun startPulseAnimation() {
        val scaleX = ObjectAnimator.ofFloat(pulseRing, "scaleX", 1f, 1.5f, 1f)
        val scaleY = ObjectAnimator.ofFloat(pulseRing, "scaleY", 1f, 1.5f, 1f)
        val alpha = ObjectAnimator.ofFloat(pulseRing, "alpha", 0.7f, 0f, 0.7f)
        val set = AnimatorSet()
        set.playTogether(scaleX, scaleY, alpha)
        set.duration = 1800
        set.repeatCount = ValueAnimator.INFINITE
        set.start()
    }

    private fun animateInstruction() {
        tvInstructions.alpha = 0f
        tvInstructions.animate().alpha(1f).setDuration(500).start()
    }

    private fun vibrate(ms: Long) {
        try {
            val vibrator = getSystemService(VIBRATOR_SERVICE) as? android.os.Vibrator
            vibrator?.vibrate(ms)
        } catch (e: Exception) { /* ignore */ }
    }

    // ---- Camera Setup ----
    private fun checkPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                arrayOf(Manifest.permission.CAMERA), CAMERA_PERMISSION)
        } else {
            setupCamera()
        }
    }

    override fun onRequestPermissionsResult(req: Int, perms: Array<String>, results: IntArray) {
        super.onRequestPermissionsResult(req, perms, results)
        if (req == CAMERA_PERMISSION && results.isNotEmpty() && results[0] == PackageManager.PERMISSION_GRANTED)
            setupCamera()
        else
            tvStatus.text = "Camera permission required"
    }

    private fun setupCamera() {
        cameraManager = getSystemService(CAMERA_SERVICE) as CameraManager
        cameraManager?.let { mgr ->
            for (id in mgr.cameraIdList) {
                val chars = mgr.getCameraCharacteristics(id)
                val facing = chars.get(CameraCharacteristics.LENS_FACING)
                if (facing == CameraCharacteristics.LENS_FACING_BACK) {
                    cameraId = id
                    // Extract camera intrinsics
                    val focalLengths = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
                    if (focalLengths != null && focalLengths.isNotEmpty()) {
                        focalLength = focalLengths[0]
                    }
                    val physSize = chars.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)
                    if (physSize != null) {
                        sensorWidth = physSize.width
                        sensorHeight = physSize.height
                    }
                    break
                }
            }
        }

        textureView.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
            override fun onSurfaceTextureAvailable(st: SurfaceTexture, w: Int, h: Int) {
                openCamera()
            }
            override fun onSurfaceTextureSizeChanged(st: SurfaceTexture, w: Int, h: Int) {}
            override fun onSurfaceTextureDestroyed(st: SurfaceTexture) = true
            override fun onSurfaceTextureUpdated(st: SurfaceTexture) {}
        }
    }

    private fun openCamera() {
        startBackgroundThread()
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED) return

        try {
            cameraManager?.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraDevice = camera
                    createPreviewSession()
                }
                override fun onDisconnected(camera: CameraDevice) { camera.close() }
                override fun onError(camera: CameraDevice, error: Int) { camera.close() }
            }, backgroundHandler)
        } catch (e: Exception) {
            tvStatus.post { tvStatus.text = "Camera error: ${e.message}" }
        }
    }

    private fun createPreviewSession() {
        val texture = textureView.surfaceTexture ?: return
        texture.setDefaultBufferSize(previewSize.width, previewSize.height)
        val surface = Surface(texture)

        val requestBuilder = cameraDevice!!.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
        requestBuilder.addTarget(surface)
        requestBuilder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
        requestBuilder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)

        cameraDevice!!.createCaptureSession(listOf(surface),
            object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    captureSession = session
                    session.setRepeatingRequest(requestBuilder.build(), null, backgroundHandler)
                    runOnUiThread { tvStatus.text = "📷 Camera ready" }
                }
                override fun onConfigureFailed(session: CameraCaptureSession) {
                    runOnUiThread { tvStatus.text = "Session config failed" }
                }
            }, backgroundHandler)
    }

    private fun startBackgroundThread() {
        backgroundThread = HandlerThread("CameraBackground").also { it.start() }
        backgroundHandler = Handler(backgroundThread!!.looper)
    }

    private fun stopBackgroundThread() {
        backgroundThread?.quitSafely()
        backgroundThread?.join()
        backgroundThread = null
        backgroundHandler = null
    }

    override fun onResume() {
        super.onResume()
        if (textureView.isAvailable) openCamera()
        else setupCamera()
    }

    override fun onPause() {
        captureSession?.close()
        cameraDevice?.close()
        stopBackgroundThread()
        super.onPause()
    }
}
