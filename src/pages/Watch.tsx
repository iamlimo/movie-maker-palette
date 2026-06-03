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
  const [content, setContent] = useState<any>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);

  useFullscreenLandscape({
    containerRef: fullscreenContainerRef,
    enabled: !!videoUrl && (isNative || isMobile),
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!contentType || !contentId) {
      setErrorTitle("Access Denied");
      setError("Invalid content");
      setLoading(false);
      return;
    }

    checkAccessAndLoad();
  }, [user, contentType, contentId, navigate]);

  const checkAccessAndLoad = async () => {
    try {
      let hasAccess = false;
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 500; 

      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        setErrorTitle("Access Denied");
        setError("Please sign in again to continue");
        setLoading(false);
        return;
      }

      // 1. High-Performance Database Guard (Replaces slower edge function invocation)
      const rpcParams = {
        p_movie_id: contentType === "movie" ? contentId : null,
        p_season_id: contentType === "season" ? contentId : null,
        p_episode_id: contentType === "episode" ? contentId : null,
      };

      while (retryCount < maxRetries) {
        const { data, error: rpcError } = await supabase.rpc(
          "verify_playback_authorization",
          rpcParams
        );

        if (!rpcError && data === true) {
          hasAccess = true;
          break; 
        }

        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }

      if (!hasAccess) {
        setErrorTitle("Access Denied");
        setError("You don't have an active rental for this content");
        setLoading(false);
        return;
      }

      // 2. Fetch content details with relational joins to prevent metadata gaps
      let contentData: any = null;
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
          const { data: showData } = await supabase
            .from("tv_shows")
            .select("slug")
            .eq("id", seasonData.tv_show_id)
            .maybeSingle();

          if (showData?.slug) {
            navigate(`/tvshow/${showData.slug}`);
            return;
          }
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

        const watchMap = (historyData || []).reduce<Record<string, any>>((map, entry) => {
          map[entry.content_id] = { completed: entry.completed, progress: entry.progress || 0 };
          return map;
        }, {});

        const nextEpisode = episodesData.find((ep) => {
          const history = watchMap[ep.id];
          return !history || (!history.completed && history.progress < 90);
        }) || episodesData[0];

        navigate(`/watch/episode/${nextEpisode.id}`);
        return;
      }

      if (!contentData) {
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

        videoUrlData = (urlError || !urlData?.signedUrl) 
          ? { url: contentData.video_url } 
          : { url: urlData.signedUrl };

      } else if (contentType === "episode") {
        const { data: urlData, error: urlError } = await supabase.functions.invoke("get-video-url", {
          body: { contentId, episodeId: contentId, contentType: "episode", expiryHours: 24 },
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const resolveSignedUrl = (input: any): string | null => {
          if (input == null) return null;
          if (typeof input === "string") {
            try {
              const parsed = JSON.parse(input);
              if (parsed?.signedUrl) return parsed.signedUrl;
              if (parsed?.data?.signedUrl) return parsed.data.signedUrl;
            } catch {
              return null;
            }
          }
          if (typeof input === "object") {
            if (input.signedUrl) return input.signedUrl;
            if (input.data?.signedUrl) return input.data.signedUrl;
          }
          return null;
        };

        const signedUrl = resolveSignedUrl(urlData);

        if (urlError || !signedUrl) {
          setErrorTitle("Video Unavailable");
          setError(urlError?.message || "Secure token generation failed for media stream");
          setLoading(false);
          return;
        }

        videoUrlData = { url: signedUrl };
      }

      if (!videoUrlData?.url) {
        setErrorTitle("Video Unavailable");
        setError("Stream URI resolution failed");
        setLoading(false);
        return;
      }

      setVideoUrl(videoUrlData.url);
      setLoading(false);
    } catch (err) {
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
  const contentTitle = contentType === "movie" 
    ? (content?.title ?? "Untitled Movie")
    : `${content?.seasons?.tv_shows?.title ?? "Show"} - Season ${content?.seasons?.season_number ?? ""} Ep ${content?.episode_number ?? ""}`;

  const contentPoster = contentType === "movie"
    ? (content?.thumbnail_url ?? "")
    : (content?.seasons?.tv_shows?.thumbnail_url ?? content?.thumbnail_url ?? "");

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
              subtitleUrl={content?.subtitle_url ?? ""}
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