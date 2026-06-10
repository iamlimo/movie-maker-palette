import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VideoPlayer } from "@/components/VideoPlayer";
import NativeVideoPlayer from "@/components/NativeVideoPlayer";
import { usePlatform } from "@/hooks/usePlatform";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFullscreenLandscape } from "@/hooks/useFullscreenLandscape";
import { Loader2, ArrowLeft } from "lucide-react"; // Unified line here

const Watch = () => {
  const { contentType, contentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isNative, isIOS, isAndroid } = usePlatform();
  const isMobile = useIsMobile();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState("Access Denied");
  const [content, setContent] = useState<unknown>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);

  // Prevent in-flight async calls from older route params overwriting newer UI state
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const guardSetState = (requestId: unknown) => {
    return (
      isMountedRef.current &&
      typeof requestId === "number" &&
      requestId === requestIdRef.current
    );
  };

  useFullscreenLandscape({
    containerRef: fullscreenContainerRef,
    enabled: !!videoUrl && (isNative || isMobile),
  });

  useEffect(() => {
    // New params => invalidate previous async work
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    // Reset UI to avoid showing stale Access Denied while new check starts
    setLoading(true);
    setError(null);
    setErrorTitle("Access Denied");
    setContent(null);
    setVideoUrl(null);

    if (!user) {
      navigate("/auth");
      return;
    }

    if (!contentType || !contentId) {
      if (guardSetState(requestId)) {
        setErrorTitle("Access Denied");
        setError("Invalid content");
        setLoading(false);
      }
      return;
    }

    checkAccessAndLoad(requestId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, contentType, contentId, navigate]);

  const checkAccessAndLoad = async (requestId: number) => {
    try {
      if (!guardSetState(requestId)) return;

      let hasAccess = false;
      let retryCount = 0;

      // Entitlements may be written slightly after checkout/webhook completes.
      // Season rentals are more prone to this race condition, so we give them
      // a longer retry window before showing Access Denied.
      const isSeasonWatch = contentType === "season";
      const maxRetries = isSeasonWatch ? 12 : 3; // ~6s for season (~12*500ms) vs ~1.5s default
      const retryDelay = isSeasonWatch ? 500 : 500;

      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        if (guardSetState(requestId)) {
          setErrorTitle("Access Denied");
          setError("Please sign in again to continue");
          setLoading(false);
        }
        return;
      }

      // 1. Access Guard (edge function is the canonical entitlement checker)
      // This avoids false negatives caused by RPC timing/episode delegation.
      while (retryCount < maxRetries) {
        const { data: accessData, error: accessError } = await supabase.functions.invoke(
          "rental-access",
          {
            body: {
              content_id: contentId,
              content_type: contentType,
            },
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        const hasAccessNow = (() => {
          if (!accessData || typeof accessData !== "object") return false;
          const row = accessData as Record<string, unknown>;
          return row["has_access"] === true;
        })();

        if (!accessError && hasAccessNow) {
          hasAccess = true;
          break;
        }

        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }

      if (!hasAccess) {
        if (!guardSetState(requestId)) return;
        setErrorTitle("Access Denied");
        setError("You don't have an active rental for this content");
        setLoading(false);
        return;
      }

      // 2. Fetch content details with relational joins to prevent metadata gaps
      let contentData: unknown = null;
      if (contentType === "movie") {
        const { data } = await supabase
          .from("movies")
          .select("*")
          .eq("id", contentId)
          .single();
        contentData = data;
      } else if (contentType === "episode") {
        // FIXED: Relational nested fetch to grab parent TV Show details natively
        const { data } = await supabase
          .from("episodes")
          .select(`
            *,
            seasons!inner (
              season_number,
              tv_shows!inner (
                title,
                thumbnail_url
              )
            )
          `)
          .eq("id", contentId)
          .single();
        contentData = data;
      } else if (contentType === "season") {
        const { data: seasonData, error: seasonError } = await supabase
          .from("seasons")
          .select("id, season_number, tv_show_id")
          .eq("id", contentId)
          .single();

        if (seasonError || !seasonData) {
          if (!guardSetState(requestId)) return;
          setErrorTitle("Video Unavailable");
          setError("Season not found");
          setLoading(false);
          return;
        }

        const { data: episodesData, error: episodesError } = await supabase
          .from("episodes")
          .select("id, episode_number")
          .eq("season_id", contentId)
          .order("episode_number", { ascending: true });

        if (episodesError || !episodesData || episodesData.length === 0) {
          if (!guardSetState(requestId)) return;
          const { data: showData } = await supabase
            .from("tv_shows")
            .select("slug")
            .eq("id", seasonData.tv_show_id)
            .maybeSingle();

          if (showData?.slug) {
            navigate(`/tvshow/${showData.slug}`);
            return;
          }
          if (!guardSetState(requestId)) return;
          setErrorTitle("Video Unavailable");
          setError("Season content structural mismatch");
          setLoading(false);
          return;
        }

        const episodeIds = episodesData.map((ep) => ep.id);
        const { data: historyData } = await supabase
          .from("watch_history")
          .select("content_id, completed, progress")
          .eq("user_id", user.id)
          .in("content_id", episodeIds);

        const watchMap = (historyData || []).reduce<Record<string, { completed: boolean; progress: number }>>(
          (map, entry) => {
            map[entry.content_id] = { completed: entry.completed, progress: entry.progress || 0 };
            return map;
          },
          {},
        );

        const nextEpisode = episodesData.find((ep) => {
          const history = watchMap[ep.id];
          return !history || (!history.completed && history.progress < 90);
        }) || episodesData[0];

        navigate(`/watch/episode/${nextEpisode.id}`);
        return;
      }

      if (!contentData) {
        if (!guardSetState(requestId)) return;
        setErrorTitle("Video Unavailable");
        setError("Content metadata record could not be resolved");
        setLoading(false);
        return;
      }

      setContent(contentData);

      // 3. Resolve Media Asset Streams
      let videoUrlData: { url: string } | null = null;

      if (contentType === "movie") {
        const { data: urlData, error: urlError } = await supabase.functions.invoke("get-video-url", {
          body: { movieId: contentId },
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const typedContentData = contentData as { video_url?: string } | null;
        videoUrlData = (urlError || !urlData?.signedUrl)
          ? { url: typedContentData?.video_url ?? "" }
          : { url: urlData.signedUrl };

      } else if (contentType === "episode") {
        const { data: urlData, error: urlError } = await supabase.functions.invoke("get-video-url", {
          body: { contentId, episodeId: contentId, contentType: "episode", expiryHours: 24 },
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const resolveSignedUrl = (input: unknown): string | null => {
          if (input == null) return null;

          if (typeof input === "string") {
            try {
              const parsed = JSON.parse(input) as
                | { signedUrl?: unknown; data?: { signedUrl?: unknown } }
                | null;
              const signedUrl = parsed?.signedUrl;
              if (typeof signedUrl === "string") return signedUrl;

              const dataSignedUrl = parsed?.data?.signedUrl;
              if (typeof dataSignedUrl === "string") return dataSignedUrl;
            } catch {
              return null;
            }
          }

          if (typeof input === "object") {
            const obj = input as Record<string, unknown>;
            const signedUrl = obj["signedUrl"];
            if (typeof signedUrl === "string") return signedUrl;

            const data = obj["data"];
            if (typeof data === "object" && data !== null) {
              const dataObj = data as Record<string, unknown>;
              const dataSignedUrl = dataObj["signedUrl"];
              if (typeof dataSignedUrl === "string") return dataSignedUrl;
            }
          }

          return null;
        };

        const signedUrl = resolveSignedUrl(urlData);

        if (urlError || !signedUrl) {
          if (!guardSetState(requestId)) return;
          setErrorTitle("Video Unavailable");
          setError(urlError?.message || "Secure token generation failed for media stream");
          setLoading(false);
          return;
        }

        videoUrlData = { url: signedUrl };
      }

      if (!videoUrlData?.url) {
        if (!guardSetState(requestId)) return;
        setErrorTitle("Video Unavailable");
        setError("Stream URI resolution failed");
        setLoading(false);
        return;
      }

      if (!guardSetState(requestId)) return;
      setVideoUrl(videoUrlData.url);
      setLoading(false);
    } catch (err) {
      if (!guardSetState(requestId)) return;
      console.error("Critical crash inside playback thread:", err);
      setErrorTitle("Video Unavailable");
      setError("An unexpected error occurred while setting up the player");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white p-6">
          <h1 className="text-2xl font-bold mb-4">{errorTitle}</h1>
          <p className="mb-4 text-gray-400">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Formatting strings safely out of unified object types
  const typedContent = content as
    | null
    | {
        title?: string;
        thumbnail_url?: string;
        subtitle_url?: string;
        video_url?: string;
        episode_number?: number;
        seasons?: {
          season_number?: number;
          tv_shows?: { title?: string; thumbnail_url?: string };
        };
        [key: string]: unknown;
      };

  const contentTitle = contentType === "movie"
    ? (typedContent?.title ?? "Untitled Movie")
    : `${typedContent?.seasons?.tv_shows?.title ?? "Show"} - Season ${typedContent?.seasons?.season_number ?? ""} Ep ${typedContent?.episode_number ?? ""}`;

  const contentPoster = contentType === "movie"
    ? (typedContent?.thumbnail_url ?? "")
    : (typedContent?.seasons?.tv_shows?.thumbnail_url ?? typedContent?.thumbnail_url ?? "");

return (
    <div 
      ref={fullscreenContainerRef} 
      className="min-h-screen bg-black relative group select-none"
    >
      {/* Premium Floating Back Button Layer */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 z-50 flex items-center justify-center bg-black/40 hover:bg-black/70 text-white p-3 rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out transform -translate-x-2 group-hover:translate-x-0 cursor-pointer shadow-2xl border border-white/10 hover:scale-105 active:scale-95"
        title="Go Back"
        aria-label="Return to previous page"
      >
        <ArrowLeft className="h-6 w-6 transition-transform group-hover/btn:-translate-x-0.5" />
      </button>

      {videoUrl && content && (
        <>
          {/* Use Native Player on iOS/Android if available */}
          {isNative && (isIOS || isAndroid) ? (
            <NativeVideoPlayer
              contentId={contentId!}
              contentType={contentType as "movie" | "episode"}
              videoUrl={videoUrl}
              title={contentTitle}
              poster={contentPoster}
              subtitleUrl={typedContent?.subtitle_url ?? ""}
              autoPlay={true}
            />
          ) : (
            /* Fallback to Web Player on desktop or web platforms */
            <VideoPlayer
              src={videoUrl}
              contentId={contentId!}
              contentType={contentType!}
              title={contentTitle}
              poster={contentPoster}
              autoPlay={true}
              immersive={true}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Watch;