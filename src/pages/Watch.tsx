import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VideoPlayer } from "@/components/VideoPlayer";
import NativeVideoPlayer from "@/components/NativeVideoPlayer";
import SystemVideoPlayer from "@/components/SystemVideoPlayer";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/hooks/usePlatform";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFullscreenLandscape } from "@/hooks/useFullscreenLandscape";
import { Loader2 } from "lucide-react";

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

  // Auto-launch fullscreen + landscape lock once a playable video is loaded.
  // Native (iOS/Android): orientation lock via @capacitor/screen-orientation.
  // Mobile web: requestFullscreen on the container + best-effort orientation lock.
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
      let accessData = null;
      let accessError = null;
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 500; // ms
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        setErrorTitle("Access Denied");
        setError("Please sign in again to continue");
        setLoading(false);
        return;
      }

      // Retry logic for access check (database sync delay)
      while (retryCount < maxRetries) {
        const result = await supabase.functions.invoke("rental-access", {
          body: { content_id: contentId, content_type: contentType },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        accessError = result.error;
        accessData = result.data;

        if (accessData?.has_access) {
          break; // Access verified, proceed
        }

        retryCount++;
        if (retryCount < maxRetries) {
          // Wait before retrying to allow database to sync
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }

      if (accessError || !accessData?.has_access) {
        console.error("Watch access check failed:", {
          contentId,
          contentType,
          accessError,
          accessData,
        });
        setErrorTitle("Access Denied");
        setError("You don't have access to this content");
        setLoading(false);
        return;
      }

      // Fetch content details
      let contentData;
      if (contentType === "movie") {
        const { data } = await supabase
          .from("movies")
          .select("*")
          .eq("id", contentId)
          .single();
        contentData = data;
      } else if (contentType === "episode") {
        const { data } = await supabase
          .from("episodes")
          .select("*")
          .eq("id", contentId)
          .single();
        contentData = data;
      } else if (contentType === "season") {
        // Seasons are rented as a package but are not directly playable.
        const { data: seasonData, error: seasonError } = await supabase
          .from("seasons")
          .select("id, season_number, tv_show_id")
          .eq("id", contentId)
          .single();

        if (seasonError || !seasonData) {
          console.error("Season fetch error:", seasonError);
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
          console.error("Season episodes fetch error:", episodesError);
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
          setError("Season not found");
          setLoading(false);
          return;
        }

        const episodeIds = (episodesData as Array<{ id: string }>).map(
          (episode) => episode.id,
        );
        const { data: historyData } = await supabase
          .from("watch_history")
          .select("content_id, completed, progress")
          .eq("user_id", user.id)
          .in("content_id", episodeIds);

        const watchMap = (historyData || []).reduce<
          Record<string, { completed: boolean; progress: number }>
        >(
          (map, entry: { content_id: string; completed: boolean; progress?: number }) => {
            map[entry.content_id] = {
              completed: entry.completed,
              progress: entry.progress || 0,
            };
            return map;
          },
          {},
        );

        const nextEpisode =
          (episodesData as Array<{ id: string }>).find((episode) => {
            const history = watchMap[episode.id];
            return !history || (!history.completed && history.progress < 90);
          }) || episodesData[0];

        navigate(`/watch/episode/${nextEpisode.id}`);
        return;
      }

      if (!contentData) {
        setErrorTitle("Video Unavailable");
        setError("Content not found");
        setLoading(false);
        return;
      }

      setContent(contentData);

      // Get video URL based on content type
      let videoUrlData: { url: string } | null = null;

      if (contentType === "movie") {
        // Use get-video-url function for movies (generates signed URL)
        const { data: urlData, error: urlError } =
          await supabase.functions.invoke("get-video-url", {
            body: { movieId: contentId },
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

        if (urlError || !urlData?.signedUrl) {
          // Fallback to direct URL from database
          videoUrlData = { url: contentData.video_url };
        } else {
          videoUrlData = { url: urlData.signedUrl };
        }
      } else if (contentType === "episode") {
        const { data: urlData, error: urlError } =
          await supabase.functions.invoke("get-video-url", {
            body: {
              contentId,
              episodeId: contentId,
              contentType: "episode",
              expiryHours: 24,
            },
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

        const resolveSignedUrl = (input: unknown): string | null => {
          // Observed in logs: urlData can be a JSON string:
          // "{\"success\":true,\"signedUrl\":\"https://...\",\"expiresAt\":\"...\"}"
          if (input == null) return null;

          if (typeof input === "string") {
            try {
              const parsed: unknown = JSON.parse(input);

              if (
                typeof parsed === "object" &&
                parsed !== null &&
                "signedUrl" in parsed &&
                typeof (parsed as { signedUrl?: unknown }).signedUrl === "string"
              ) {
                return (parsed as { signedUrl: string }).signedUrl;
              }

              if (typeof parsed === "object" && parsed !== null && "data" in parsed) {
                const dataVal = (parsed as { data?: unknown }).data;
                if (
                  typeof dataVal === "object" &&
                  dataVal !== null &&
                  "signedUrl" in dataVal &&
                  typeof (dataVal as { signedUrl?: unknown }).signedUrl === "string"
                ) {
                  return (dataVal as { signedUrl: string }).signedUrl;
                }
              }

              return null;
            } catch {
              return null;
            }
          }

          if (typeof input === "object" && input !== null) {
            const obj = input as Record<string, unknown>;
            const directSigned = obj["signedUrl"];
            if (typeof directSigned === "string") return directSigned;

            const dataVal = obj["data"];
            if (typeof dataVal === "object" && dataVal !== null) {
              const dataObj = dataVal as Record<string, unknown>;
              const nestedSigned = dataObj["signedUrl"];
              if (typeof nestedSigned === "string") return nestedSigned;
            }
          }

          return null;
        };

        const signedUrl = resolveSignedUrl(urlData);

        if (urlError || !signedUrl) {
          console.error("Episode video URL generation failed:", {
            contentId,
            contentType,
            urlError,
            urlData,
          });
          setErrorTitle("Video Unavailable");

          const errorFromUrlData =
            typeof urlData === "object" && urlData !== null
              ? (urlData as Record<string, unknown>)["error"]
              : undefined;

          const errorMsg =
            (typeof errorFromUrlData === "string" && errorFromUrlData) ||
            urlError?.message ||
            (typeof urlData === "string"
              ? "Failed to parse video URL response"
              : "Failed to load video");

          setError(errorMsg);
          setLoading(false);
          return;
        }

        videoUrlData = { url: signedUrl };
      }

      if (!videoUrlData?.url) {
        console.error("Watch video URL missing:", {
          contentId,
          contentType,
          videoUrlData,
        });
        setErrorTitle("Video Unavailable");
        setError("Failed to load video");
        setLoading(false);
        return;
      }

      setVideoUrl(videoUrlData.url);
      setLoading(false);
    } catch (err: unknown) {
      console.error("Error loading content:", err);
      setErrorTitle("Video Unavailable");
      setError("Failed to load content");
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
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">{errorTitle}</h1>
          <p className="mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={fullscreenContainerRef} className="min-h-screen bg-black">
      {videoUrl && content && (
        <>
          {/* Use Native Player on iOS/Android if available */}
          {isNative && (isIOS || isAndroid) ? (
            <NativeVideoPlayer
              contentId={contentId!}
              contentType={contentType as "movie" | "episode"}
              videoUrl={videoUrl}
              title={
                contentType === "movie"
                  ? ((content as Record<string, unknown>)?.title as string | undefined) ?? ""
                  : `${((content as Record<string, unknown>)?.show_title as
                      | string
                      | undefined) ?? "Show"} - Episode ${
                      ((content as Record<string, unknown>)?.episode_number as
                        | number
                        | undefined) ?? ""
                    }`
              }
              poster={
                contentType === "movie"
                  ? (((content as Record<string, unknown>)?.thumbnail_url as
                      | string
                      | undefined) ?? "")
                  : (((content as Record<string, unknown>)?.seasons as
                      | { tv_shows?: { thumbnail_url?: string } }
                      | undefined)?.tv_shows?.thumbnail_url as string | undefined) ??
                    ""
              }
              subtitleUrl={
                ((content as Record<string, unknown>)?.subtitle_url as
                  | string
                  | undefined) ?? ""
              }
              autoPlay={true}
            />
          ) : (
            // Fallback to Web Player on desktop or web platforms
            <VideoPlayer
              src={videoUrl}
              contentId={contentId!}
              contentType={contentType!}
              title={
                contentType === "movie"
                  ? (((content as Record<string, unknown>)?.title as
                      | string
                      | undefined) ?? "")
                  : `${(((content as Record<string, unknown>)?.seasons as
                      | { tv_shows?: { title?: string } }
                      | undefined)?.tv_shows?.title ?? "Show")} - Episode ${
                      ((content as Record<string, unknown>)?.episode_number as
                        | number
                        | undefined) ?? ""
                    }`
              }
              poster={
                (((content as Record<string, unknown>)?.thumbnail_url as
                  | string
                  | undefined) ?? "") ||
                (((content as Record<string, unknown>)?.poster_url as
                  | string
                  | undefined) ?? "")
              }
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
