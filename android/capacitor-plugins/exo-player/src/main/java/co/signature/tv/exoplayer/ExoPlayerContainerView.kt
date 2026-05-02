package co.signature.tv.exoplayer

import android.app.Activity
import android.graphics.Color
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.PlayerView

@UnstableApi
class ExoPlayerContainerView(private val activity: Activity) {

    private var container: FrameLayout? = null
    private var playerView: PlayerView? = null

    fun ensureAttached(): PlayerView {
        if (container != null && playerView != null) return playerView!!
        val root = activity.findViewById<ViewGroup>(android.R.id.content)

        val frame = FrameLayout(activity).apply {
            setBackgroundColor(Color.BLACK)
            layoutParams = FrameLayout.LayoutParams(0, 0)
        }
        val pv = PlayerView(activity).apply {
            useController = false
            setShutterBackgroundColor(Color.BLACK)
        }
        frame.addView(pv, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        root.addView(frame)
        container = frame
        playerView = pv
        return pv
    }

    fun setRect(xPx: Int, yPx: Int, widthPx: Int, heightPx: Int) {
        val frame = container ?: return
        val lp = FrameLayout.LayoutParams(widthPx, heightPx)
        lp.leftMargin = xPx
        lp.topMargin = yPx
        frame.layoutParams = lp
        frame.requestLayout()
    }

    fun remove() {
        val frame = container ?: return
        (frame.parent as? ViewGroup)?.removeView(frame)
        container = null
        playerView = null
    }

    fun view(): PlayerView? = playerView
}