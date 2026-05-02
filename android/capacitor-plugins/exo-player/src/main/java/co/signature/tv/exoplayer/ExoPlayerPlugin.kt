package co.signature.tv.exoplayer

import androidx.media3.common.util.UnstableApi
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@UnstableApi
@CapacitorPlugin(name = "ExoPlayer")
class ExoPlayerPlugin : Plugin() {

    private var manager: ExoPlayerManager? = null
    private var containerView: ExoPlayerContainerView? = null
    private val density: Float by lazy { context.resources.displayMetrics.density }

    private val listener = object : ExoPlayerManager.Listener {
        override fun onReady(durationMs: Long) {
            notifyListeners("onReady", JSObject().put("duration", durationMs / 1000.0))
        }
        override fun onBuffering() { notifyListeners("onBuffering", JSObject()) }
        override fun onPlaying() { notifyListeners("onPlaying", JSObject()) }
        override fun onPaused() { notifyListeners("onPaused", JSObject()) }
        override fun onEnded() { notifyListeners("onEnded", JSObject()) }
        override fun onError(code: String, message: String) {
            notifyListeners("onError", JSObject().put("code", code).put("message", message))
        }
        override fun onProgress(positionMs: Long, durationMs: Long) {
            val data = JSObject()
                .put("currentTime", positionMs / 1000.0)
                .put("duration", durationMs / 1000.0)
            notifyListeners("onProgress", data)
        }
    }

    @PluginMethod
    fun initPlayer(call: PluginCall) {
        ensureManager()
        ensureContainer()
        call.resolve()
    }

    @PluginMethod
    fun load(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrBlank()) { call.reject("Missing url"); return }
        val type = call.getString("type")
        val startMs = (call.getDouble("startPositionMs") ?: 0.0).toLong()
        val subtitleUrl = call.getString("subtitleUrl")
        val subtitleLang = call.getString("subtitleLanguage")

        ensureManager()
        val pv = ensureContainer().ensureAttached()
        manager!!.attach(pv)
        manager!!.load(url, type, startMs, subtitleUrl, subtitleLang)
        call.resolve()
    }

    @PluginMethod fun play(call: PluginCall) { manager?.play(); call.resolve() }
    @PluginMethod fun pause(call: PluginCall) { manager?.pause(); call.resolve() }

    @PluginMethod
    fun seekTo(call: PluginCall) {
        val seconds = call.getDouble("position") ?: 0.0
        manager?.seekTo((seconds * 1000.0).toLong())
        call.resolve()
    }

    @PluginMethod fun stop(call: PluginCall) { manager?.stop(); call.resolve() }

    @PluginMethod
    fun release(call: PluginCall) {
        bridge?.activity?.runOnUiThread {
            containerView?.let { cv ->
                cv.view()?.let { manager?.detach(it) }
                cv.remove()
            }
            containerView = null
            manager?.release()
            manager = null
            call.resolve()
        }
    }

    @PluginMethod
    fun setRect(call: PluginCall) {
        val x = (call.getDouble("x") ?: 0.0).toFloat()
        val y = (call.getDouble("y") ?: 0.0).toFloat()
        val w = (call.getDouble("width") ?: 0.0).toFloat()
        val h = (call.getDouble("height") ?: 0.0).toFloat()
        val cv = ensureContainer()
        bridge?.activity?.runOnUiThread {
            cv.ensureAttached()
            cv.setRect((x * density).toInt(), (y * density).toInt(), (w * density).toInt(), (h * density).toInt())
            call.resolve()
        }
    }

    @PluginMethod
    fun getDuration(call: PluginCall) {
        val ms = manager?.duration() ?: 0L
        call.resolve(JSObject().put("duration", ms / 1000.0))
    }

    @PluginMethod
    fun getCurrentTime(call: PluginCall) {
        val ms = manager?.currentPosition() ?: 0L
        call.resolve(JSObject().put("currentTime", ms / 1000.0))
    }

    @PluginMethod
    fun setPlaybackRate(call: PluginCall) {
        val rate = (call.getDouble("rate") ?: 1.0).toFloat()
        manager?.setPlaybackRate(rate)
        call.resolve()
    }

    override fun handleOnPause() {
        super.handleOnPause()
        manager?.pause()
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        try {
            containerView?.let { cv ->
                cv.view()?.let { manager?.detach(it) }
                cv.remove()
            }
            containerView = null
            manager?.release()
            manager = null
        } catch (_: Throwable) {}
    }

    private fun ensureManager(): ExoPlayerManager {
        val m = manager ?: ExoPlayerManager.get(context).also { manager = it }
        m.setListener(listener)
        return m
    }

    private fun ensureContainer(): ExoPlayerContainerView {
        val activity = bridge.activity
        return containerView ?: ExoPlayerContainerView(activity).also { containerView = it }
    }
}