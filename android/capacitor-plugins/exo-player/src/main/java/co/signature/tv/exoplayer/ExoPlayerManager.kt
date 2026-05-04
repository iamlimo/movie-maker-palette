package co.signature.tv.exoplayer

import android.app.Activity
import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.MergingMediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.exoplayer.source.SingleSampleMediaSource
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.PlayerView
import java.io.File

@UnstableApi
class ExoPlayerManager private constructor(context: Context) {

    interface Listener {
        fun onReady(durationMs: Long)
        fun onBuffering()
        fun onPlaying()
        fun onPaused()
        fun onEnded()
        fun onError(code: String, message: String)
        fun onProgress(positionMs: Long, durationMs: Long)
    }

    private val appContext: Context = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())
private var listener: Listener? = null
    private var currentTitle: String? = null
    private var progressRunnable: Runnable? = null

    val player: ExoPlayer
    private val cache: SimpleCache by lazy { buildCache(appContext) }

    init {
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(15_000, 50_000, 1_500, 3_000)
            .build()

        player = ExoPlayer.Builder(appContext)
            .setTrackSelector(DefaultTrackSelector(appContext))
            .setLoadControl(loadControl)
            .setLooper(Looper.getMainLooper())
            .build()

        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                when (state) {
                    Player.STATE_READY -> listener?.onReady(player.duration.coerceAtLeast(0))
                    Player.STATE_BUFFERING -> listener?.onBuffering()
                    Player.STATE_ENDED -> listener?.onEnded()
                    Player.STATE_IDLE -> Unit
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) listener?.onPlaying() else listener?.onPaused()
            }

            override fun onPlayerError(error: PlaybackException) {
                listener?.onError(error.errorCodeName, error.message ?: "Playback error")
            }
        })
    }

    fun setListener(l: Listener?) { listener = l }

    fun setTitle(title: String) {
        currentTitle = title
    }

    fun load(url: String, type: String?, startPositionMs: Long, subtitleUrl: String?, subtitleLang: String?, contentId: String? = null, contentType: String? = null) {
        android.util.Log.d("ExoPlayer", "Loading rented ${contentType ?: "content"} (ID: ${contentId ?: "unknown"}): $url")
        runOnMain {
            val uri = Uri.parse(url)
            val httpFactory = DefaultHttpDataSource.Factory()
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15_000)
                .setReadTimeoutMs(15_000)

            val cacheFactory = CacheDataSource.Factory()
                .setCache(cache)
                .setUpstreamDataSourceFactory(httpFactory)
                .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

            val resolvedType = (type ?: if (url.contains(".m3u8")) "hls" else "progressive").lowercase()

            val mediaItemBuilder = MediaItem.Builder().setUri(uri)
            if (!subtitleUrl.isNullOrBlank()) {
                val sub = MediaItem.SubtitleConfiguration.Builder(Uri.parse(subtitleUrl))
                    .setMimeType(if (subtitleUrl.endsWith(".srt")) MimeTypes.APPLICATION_SUBRIP else MimeTypes.TEXT_VTT)
                    .setLanguage(subtitleLang ?: "en")
                    .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                    .build()
                mediaItemBuilder.setSubtitleConfigurations(listOf(sub))
            }
            val mediaItem = mediaItemBuilder.build()

            val mediaSource: MediaSource = when (resolvedType) {
                "hls" -> HlsMediaSource.Factory(cacheFactory).createMediaSource(mediaItem)
                else -> ProgressiveMediaSource.Factory(cacheFactory).createMediaSource(mediaItem)
            }

            val finalSource: MediaSource = if (!subtitleUrl.isNullOrBlank()) {
                val subFormat = androidx.media3.common.Format.Builder()
                    .setSampleMimeType(if (subtitleUrl.endsWith(".srt")) MimeTypes.APPLICATION_SUBRIP else MimeTypes.TEXT_VTT)
                    .setLanguage(subtitleLang ?: "en")
                    .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                    .build()
                val subSource = SingleSampleMediaSource.Factory(cacheFactory)
                    .createMediaSource(MediaItem.SubtitleConfiguration.Builder(Uri.parse(subtitleUrl)).build(), C.TIME_UNSET)
                MergingMediaSource(mediaSource, subSource)
            } else mediaSource

            player.setMediaSource(finalSource, startPositionMs.coerceAtLeast(0))
            player.prepare()
            player.playWhenReady = false
            startProgressTicker()
        }
    }

    fun play() = runOnMain { player.playWhenReady = true }
    fun pause() = runOnMain { player.playWhenReady = false }
    fun seekTo(ms: Long) = runOnMain { player.seekTo(ms) }
    fun stop() = runOnMain { player.stop(); stopProgressTicker() }
    fun setPlaybackRate(rate: Float) = runOnMain { player.setPlaybackSpeed(rate) }
    fun currentPosition(): Long = player.currentPosition
    fun duration(): Long = player.duration.coerceAtLeast(0)

    fun attach(view: PlayerView) = runOnMain {
        view.player = player
        view.useController = false
    }

    fun detach(view: PlayerView) = runOnMain {
        if (view.player === player) view.player = null
    }

    fun release() {
        runOnMain {
            stopProgressTicker()
            player.release()
            try { cache.release() } catch (_: Throwable) {}
            instance = null
        }
    }

    private fun startProgressTicker() {
        stopProgressTicker()
        progressRunnable = object : Runnable {
            override fun run() {
                listener?.onProgress(player.currentPosition, player.duration.coerceAtLeast(0))
                mainHandler.postDelayed(this, 250)
            }
        }
        mainHandler.post(progressRunnable!!)
    }

    private fun stopProgressTicker() {
        progressRunnable?.let { mainHandler.removeCallbacks(it) }
        progressRunnable = null
    }

    private fun runOnMain(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else mainHandler.post(block)
    }

    private fun buildCache(ctx: Context): SimpleCache {
        val cacheDir = File(ctx.cacheDir, "exoplayer-media")
        if (!cacheDir.exists()) cacheDir.mkdirs()
val evictor = LeastRecentlyUsedCacheEvictor(512L * 1024L * 1024L)
        return SimpleCache(cacheDir, evictor, StandaloneDatabaseProvider(ctx))
    }

    companion object {
        @Volatile private var instance: ExoPlayerManager? = null

        @JvmStatic
        fun get(context: Context): ExoPlayerManager {
            return instance ?: synchronized(this) {
                instance ?: ExoPlayerManager(context).also { instance = it }
            }
        }
    }
}