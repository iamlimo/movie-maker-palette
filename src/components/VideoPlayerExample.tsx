import { VideoPlayer } from '@/components/VideoPlayer';

/**
 * ENHANCED VIDEO PLAYER - FEATURE SHOWCASE
 * 
 * This example demonstrates all the new features:
 * ✓ Essential Controls (Play, Pause, Volume, Seek bar)
 * ✓ Advanced Controls (Skip Intro, Next Episode, Replay 10s, Cast to TV)
 * ✓ Settings (Quality, Subtitles)
 * ✓ Movie Info Overlay (when paused)
 */

// ============================================
// EXAMPLE 1: Basic Movie Player
// ============================================
export const BasicMovieExample = () => {
  return (
    <VideoPlayer
      src="https://example.com/movie.mp4"
      title="The Matrix"
      poster="https://example.com/poster.jpg"
      description="A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers."
      cast={["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"]}
      director="The Wachowskis"
      className="w-full rounded-lg"
    />
  );
};

// ============================================
// EXAMPLE 2: TV Series Episode with All Features
// ============================================
export const TVSeriesExample = () => {
  const handleNextEpisode = () => {
    console.log('Loading next episode...');
    // Navigate to next episode or load it
  };

  return (
    <VideoPlayer
      src="https://example.com/episode.mp4"
      title="Breaking Bad"
      episodeTitle="Pilot"
      seasonNumber={1}
      episodeNumber={1}
      poster="https://example.com/bb-poster.jpg"
      description="A high school chemistry teacher and his former student turned small-time drug dealer team up with a cartel-connected private investigator-turned-meth cook."
      cast={["Bryan Cranston", "Aaron Paul", "Dean Norris"]}
      director="Vince Gilligan"
      // Series-specific features
      hasNextEpisode={true}
      onNextEpisode={handleNextEpisode}
      // Available quality options
      availableQualities={['Auto', '1080p', '720p', '480p', '240p']}
      // Available subtitle options
      availableSubtitles={[
        { code: 'en', label: 'English' },
        { code: 'es', label: 'Spanish' },
        { code: 'fr', label: 'French' },
        { code: 'de', label: 'German' },
        { code: 'ja', label: 'Japanese' },
      ]}
      className="w-full rounded-lg shadow-lg"
    />
  );
};

// ============================================
// EXAMPLE 3: Immersive Fullscreen Player
// ============================================
export const ImmersivePlayerExample = () => {
  return (
    <VideoPlayer
      movieId="movie-123" // Will use Supabase to fetch URL
      title="Inception"
      episodeTitle="A mind-bending thriller"
      poster="https://example.com/inception.jpg"
      description="A skilled thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O."
      cast={["Leonardo DiCaprio", "Marion Cotillard", "Tom Hardy"]}
      director="Christopher Nolan"
      immersive={true} // Full screen experience
      autoPlay={true}
      availableQualities={['Auto', '4K', '1080p', '720p', '480p']}
    />
  );
};

// ============================================
// EXAMPLE 4: With Custom Subtitles URL
// ============================================
export const PlayerWithSubtitlesExample = () => {
  return (
    <VideoPlayer
      src="https://example.com/video.mp4"
      title="Parasite"
      subtitleUrl="https://example.com/subtitles.vtt"
      poster="https://example.com/parasite.jpg"
      description="Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan."
      cast={["Song Kang-ho", "Lee Sun-kyun", "Cho Yeo-jeong"]}
      director="Bong Joon-ho"
      availableSubtitles={[
        { code: 'en', label: 'English' },
        { code: 'ko', label: 'Korean' },
      ]}
    />
  );
};

// ============================================
// PROPS REFERENCE
// ============================================

/**
 * VideoPlayerProps:
 * 
 * BASIC PROPS:
 * - src?: string                          // Direct video URL
 * - movieId?: string                      // Supabase movie ID (alternative to src)
 * - contentId?: string                    // Content identifier for tracking
 * - contentType?: string                  // 'movie' | 'episode'
 * - title?: string                        // Main title
 * - poster?: string                       // Poster/thumbnail image URL
 * - className?: string                    // CSS classes
 * - subtitleUrl?: string                  // URL to subtitle file
 * - autoPlay?: boolean                    // Auto-play on load
 * - immersive?: boolean                   // Full screen mode
 * 
 * ENHANCED PROPS:
 * - cast?: string[]                       // Array of actor names
 * - director?: string                     // Director name
 * - description?: string                  // Movie/episode description
 * - episodeTitle?: string                 // Episode title (for series)
 * - seasonNumber?: number                 // Season number (for series)
 * - episodeNumber?: number                // Episode number (for series)
 * - hasNextEpisode?: boolean              // Show "Next Episode" button
 * - onNextEpisode?: () => void            // Callback for next episode
 * - availableQualities?: string[]         // ['Auto', '1080p', '720p', '480p', '240p']
 * - availableSubtitles?: Array<{          // List of subtitle options
 *     code: string;                       // Language code
 *     label: string;                      // Display label
 *   }>
 */

// ============================================
// FEATURE DESCRIPTIONS
// ============================================

/**
 * ESSENTIAL CONTROLS (Always Available):
 * 
 * 1. PLAY / PAUSE
 *    - Click play button in center or control bar
 *    - Space bar also triggers play/pause (when focused)
 * 
 * 2. SEEK BAR WITH PREVIEW
 *    - Drag to seek through video
 *    - Click to jump to position
 *    - Shows current and total time
 * 
 * 3. VOLUME CONTROL
 *    - Volume slider to adjust from 0-100%
 *    - Mute button to toggle mute state
 *    - Muting sets volume to 0
 * 
 * 4. SETTINGS MENU (⚙️)
 *    - Quality selection (Auto, 1080p, 720p, 480p, 240p)
 *    - Subtitle selection (On/Off with language options)
 * 
 * 5. FULLSCREEN
 *    - Toggle fullscreen mode
 *    - Escape key to exit fullscreen
 *    - Controls auto-hide in fullscreen after 3 seconds
 * 
 * ADVANCED CONTROLS (Premium Features):
 * 
 * 1. SKIP INTRO ⏩
 *    - Skips forward 90 seconds
 *    - Useful for TV series opening sequences
 * 
 * 2. REPLAY LAST 10 SECONDS 🔁
 *    - Rewind 10 seconds
 *    - For rewatching important moments
 * 
 * 3. NEXT EPISODE ⏭
 *    - Shows when hasNextEpisode={true}
 *    - Triggers onNextEpisode callback
 * 
 * 4. CAST TO TV 📺
 *    - Uses Google Cast API (Chromecast)
 *    - Also supports AirPlay on macOS
 * 
 * MOVIE INFO OVERLAY:
 * 
 * When video is paused, displays:
 * - Movie/Episode title
 * - Cast list (clickable badges)
 * - Director information
 * - Full description
 * - Poster image
 * - Season/Episode information (if applicable)
 * - Can be dismissed to resume playing
 */

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

/**
 * Space          - Play/Pause
 * →              - Seek forward 5 seconds
 * ←              - Seek backward 5 seconds
 * ↑              - Increase volume
 * ↓              - Decrease volume
 * M              - Mute/Unmute
 * F              - Fullscreen
 * Escape         - Exit fullscreen
 * C              - Toggle subtitles (when available)
 * J              - Seek backward 10 seconds
 * L              - Seek forward 10 seconds
 */

// ============================================
// STYLING & CUSTOMIZATION
// ============================================

/**
 * The player uses Tailwind CSS for styling:
 * 
 * COLOR SCHEME:
 * - Primary: red-600 (progress bar)
 * - Background: black/black-90 (video area)
 * - Text: white/gray-300
 * - Hover: white-20 (semi-transparent white)
 * 
 * RESPONSIVE DESIGN:
 * - Mobile: Stacked controls, no icons on small screens
 * - Tablet: All controls visible, icons + labels
 * - Desktop: Full controls with all features
 * 
 * CUSTOMIZATION:
 * Use className prop to add custom styles:
 * 
 * <VideoPlayer
 *   className="w-full max-w-4xl mx-auto rounded-xl shadow-2xl"
 *   ...
 * />
 */

// ============================================
// ERROR HANDLING
// ============================================

/**
 * If video fails to load:
 * 1. Error message is displayed
 * 2. Retry button appears
 * 3. Check console for detailed error info
 * 
 * Common issues:
 * - CORS errors: Use appropriate headers/proxy
 * - Authentication: User not logged in
 * - Bandwidth limits: Uses fallback server
 */
