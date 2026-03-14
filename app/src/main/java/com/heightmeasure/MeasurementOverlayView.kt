package com.heightmeasure

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import kotlin.math.abs

class MeasurementOverlayView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null
) : View(context, attrs) {

    enum class Mode { IDLE, TOUCH_MEASURE, RESULT }

    private var mode = Mode.IDLE
    private var headPoint: PointF? = null
    private var feetPoint: PointF? = null
    private var measuredHeightCm: Float = 0f
    private var animProgress = 0f

    // Paints
    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(30, 0, 255, 136)
        strokeWidth = 1f
        style = Paint.Style.STROKE
    }
    private val centerLinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(60, 0, 255, 136)
        strokeWidth = 2f
        style = Paint.Style.STROKE
        pathEffect = DashPathEffect(floatArrayOf(20f, 10f), 0f)
    }
    private val measureLinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#00FF88")
        strokeWidth = 4f
        style = Paint.Style.STROKE
        setShadowLayer(8f, 0f, 0f, Color.parseColor("#80FF88"))
    }
    private val measureLineDashPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(150, 0, 255, 136)
        strokeWidth = 2f
        style = Paint.Style.STROKE
        pathEffect = DashPathEffect(floatArrayOf(12f, 8f), 0f)
    }
    private val headPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#00FF88")
        style = Paint.Style.FILL
        setShadowLayer(12f, 0f, 0f, Color.parseColor("#00FF88"))
    }
    private val feetPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#FF6B35")
        style = Paint.Style.FILL
        setShadowLayer(12f, 0f, 0f, Color.parseColor("#FF6B35"))
    }
    private val headRingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#00FF88")
        style = Paint.Style.STROKE
        strokeWidth = 3f
        alpha = 180
    }
    private val feetRingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#FF6B35")
        style = Paint.Style.STROKE
        strokeWidth = 3f
        alpha = 180
    }
    private val labelBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(200, 0, 0, 0)
        style = Paint.Style.FILL
    }
    private val labelTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = 42f
        typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        textAlign = Paint.Align.CENTER
        setShadowLayer(6f, 0f, 2f, Color.BLACK)
    }
    private val heightLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#00FF88")
        textSize = 52f
        typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        textAlign = Paint.Align.LEFT
        setShadowLayer(10f, 0f, 0f, Color.parseColor("#00FF88"))
    }
    private val rulerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(200, 0, 255, 136)
        strokeWidth = 2f
        style = Paint.Style.STROKE
    }
    private val rulerTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(180, 0, 255, 136)
        textSize = 24f
        typeface = Typeface.MONOSPACE
        textAlign = Paint.Align.RIGHT
    }
    private val guideTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(180, 255, 255, 255)
        textSize = 36f
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    private val arrowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#00FF88")
        strokeWidth = 3f
        style = Paint.Style.STROKE
        setShadowLayer(6f, 0f, 0f, Color.parseColor("#00FF88"))
    }

    fun setMode(m: Mode) { mode = m; invalidate() }
    fun setHeadPoint(p: PointF) { headPoint = p; invalidate() }
    fun setFeetPoint(p: PointF) { feetPoint = p; invalidate() }

    fun setMeasurementLine(head: PointF, feet: PointF, heightCm: Float) {
        headPoint = head
        feetPoint = feet
        measuredHeightCm = heightCm
        mode = Mode.RESULT
        animProgress = 0f
        invalidate()
    }

    fun reset() {
        mode = Mode.IDLE
        headPoint = null
        feetPoint = null
        measuredHeightCm = 0f
        animProgress = 0f
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        setLayerType(LAYER_TYPE_SOFTWARE, null)

        drawGrid(canvas)
        drawCenterGuide(canvas)

        when (mode) {
            Mode.IDLE -> drawIdleGuide(canvas)
            Mode.TOUCH_MEASURE -> drawTouchGuide(canvas)
            Mode.RESULT -> drawResult(canvas)
        }
    }

    private fun drawGrid(canvas: Canvas) {
        val cols = 6
        val rows = 10
        val colWidth = width.toFloat() / cols
        val rowHeight = height.toFloat() / rows
        for (i in 1 until cols) {
            canvas.drawLine(i * colWidth, 0f, i * colWidth, height.toFloat(), gridPaint)
        }
        for (i in 1 until rows) {
            canvas.drawLine(0f, i * rowHeight, width.toFloat(), i * rowHeight, gridPaint)
        }
    }

    private fun drawCenterGuide(canvas: Canvas) {
        canvas.drawLine(width / 2f, 0f, width / 2f, height.toFloat(), centerLinePaint)
    }

    private fun drawIdleGuide(canvas: Canvas) {
        // Person silhouette hint box
        val boxW = width * 0.4f
        val boxH = height * 0.75f
        val left = (width - boxW) / 2f
        val top = height * 0.1f
        val right = left + boxW
        val bottom = top + boxH

        val cornerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(150, 0, 255, 136)
            strokeWidth = 4f
            style = Paint.Style.STROKE
        }
        val cornerLen = 40f
        // Draw corner brackets
        listOf(
            Pair(left, top) to Pair(1f, 1f),
            Pair(right, top) to Pair(-1f, 1f),
            Pair(left, bottom) to Pair(1f, -1f),
            Pair(right, bottom) to Pair(-1f, -1f)
        ).forEach { (point, dir) ->
            val (px, py) = point
            val (dx, dy) = dir
            canvas.drawLine(px, py, px + dx * cornerLen, py, cornerPaint)
            canvas.drawLine(px, py, px, py + dy * cornerLen, cornerPaint)
        }

        // Guide text
        canvas.drawText("Stand person here", width / 2f, height * 0.05f, guideTextPaint)
        canvas.drawText("Full body in frame", width / 2f, height * 0.93f, guideTextPaint)
    }

    private fun drawTouchGuide(canvas: Canvas) {
        val head = headPoint
        val feet = feetPoint

        if (head == null) {
            // Guide to tap head
            drawBlinkingTarget(canvas, width / 2f, height * 0.12f, Color.parseColor("#00FF88"), "TAP HEAD")
        } else {
            // Head placed, draw it
            drawPointMarker(canvas, head, headPaint, headRingPaint, "HEAD")

            if (feet == null) {
                // Guide to tap feet
                drawBlinkingTarget(canvas, width / 2f, height * 0.88f, Color.parseColor("#FF6B35"), "TAP FEET")
                // Draw vertical guide line from head down
                canvas.drawLine(head.x, head.y, head.x, height.toFloat(), measureLineDashPaint)
            }
        }

        if (head != null && feet != null) {
            drawPointMarker(canvas, feet, feetPaint, feetRingPaint, "FEET")
        }
    }

    private fun drawBlinkingTarget(canvas: Canvas, x: Float, y: Float, color: Int, label: String) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            style = Paint.Style.STROKE
            strokeWidth = 3f
        }
        val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = Color.argb(80, Color.red(color), Color.green(color), Color.blue(color))
            style = Paint.Style.FILL
        }
        canvas.drawCircle(x, y, 30f, fillPaint)
        canvas.drawCircle(x, y, 30f, paint)
        canvas.drawCircle(x, y, 50f, paint.apply { alpha = 120 })
        canvas.drawLine(x - 70f, y, x - 35f, y, paint.apply { alpha = 255 })
        canvas.drawLine(x + 35f, y, x + 70f, y, paint)
        canvas.drawLine(x, y - 70f, x, y - 35f, paint)
        canvas.drawLine(x, y + 35f, x, y + 70f, paint)

        val lPaint = Paint(labelTextPaint).apply { this.color = color; textSize = 36f }
        canvas.drawText(label, x, y + 90f, lPaint)
    }

    private fun drawPointMarker(canvas: Canvas, point: PointF, fill: Paint, ring: Paint, label: String) {
        canvas.drawCircle(point.x, point.y, 18f, fill)
        canvas.drawCircle(point.x, point.y, 32f, ring)
        canvas.drawCircle(point.x, point.y, 50f, ring.apply { alpha = 80 })
        // Label background
        val lx = point.x + 60f
        val ly = point.y + 16f
        val rect = RectF(lx - 10f, ly - 36f, lx + labelTextPaint.measureText(label) + 10f, ly + 8f)
        canvas.drawRoundRect(rect, 8f, 8f, labelBgPaint)
        canvas.drawText(label, lx + labelTextPaint.measureText(label) / 2f, ly, labelTextPaint)
    }

    private fun drawResult(canvas: Canvas) {
        val head = headPoint ?: return
        val feet = feetPoint ?: return

        // Draw the measurement line
        canvas.drawLine(head.x, head.y, feet.x, feet.y, measureLinePaint)

        // Draw ruler ticks on the line
        drawRulerTicks(canvas, head, feet)

        // Draw head/feet markers
        drawPointMarker(canvas, head, headPaint, headRingPaint, "HEAD")
        drawPointMarker(canvas, feet, feetPaint, feetRingPaint, "FEET")

        // Draw arrows at both ends
        drawArrow(canvas, head.x, head.y, true)
        drawArrow(canvas, feet.x, feet.y, false)

        // Draw horizontal end bars
        val barHalf = 40f
        canvas.drawLine(head.x - barHalf, head.y, head.x + barHalf, head.y, measureLinePaint)
        canvas.drawLine(feet.x - barHalf, feet.y, feet.x + barHalf, feet.y, measureLinePaint.apply {
            color = Color.parseColor("#FF6B35")
        })
        measureLinePaint.color = Color.parseColor("#00FF88")

        // Height label in middle
        val midX = (head.x + feet.x) / 2f + 80f
        val midY = (head.y + feet.y) / 2f
        val feet_i = (measuredHeightCm / 30.48f).toInt()
        val inches_i = ((measuredHeightCm / 2.54f) % 12).toInt()
        val label = "${measuredHeightCm.toInt()} cm"
        val label2 = "$feet_i' $inches_i\""

        val bgRect = RectF(midX - 10f, midY - 60f, midX + 200f, midY + 56f)
        canvas.drawRoundRect(bgRect, 12f, 12f, labelBgPaint)
        canvas.drawText(label, midX + 10f, midY - 10f, heightLabelPaint)
        val smallPaint = Paint(heightLabelPaint).apply {
            textSize = 38f
            color = Color.parseColor("#FF6B35")
        }
        canvas.drawText(label2, midX + 10f, midY + 44f, smallPaint)
    }

    private fun drawRulerTicks(canvas: Canvas, head: PointF, feet: PointF) {
        val dx = feet.x - head.x
        val dy = feet.y - head.y
        val totalLen = Math.sqrt((dx * dx + dy * dy).toDouble()).toFloat()
        val tickCount = 10
        val perpX = -dy / totalLen * 15f
        val perpY = dx / totalLen * 15f

        for (i in 0..tickCount) {
            val t = i.toFloat() / tickCount
            val px = head.x + dx * t
            val py = head.y + dy * t
            val tickLen = if (i % 5 == 0) 1.5f else 1f
            canvas.drawLine(px - perpX * tickLen, py - perpY * tickLen,
                px + perpX * tickLen, py + perpY * tickLen, rulerPaint)
        }
    }

    private fun drawArrow(canvas: Canvas, x: Float, y: Float, pointUp: Boolean) {
        val arrowSize = 20f
        val dir = if (pointUp) -1f else 1f
        val path = Path().apply {
            moveTo(x, y)
            lineTo(x - arrowSize, y + dir * arrowSize)
            moveTo(x, y)
            lineTo(x + arrowSize, y + dir * arrowSize)
        }
        canvas.drawPath(path, arrowPaint)
    }
}
