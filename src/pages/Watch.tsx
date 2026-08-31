import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VideoPlayer } from "@/components/VideoPlayer";
import NativeVideoPlayer from "@/components/NativeVideoPlayer";
import { usePlatform } from "@/hooks/usePlatform";
import { Loader2 } from "lucide-react";
import { resolveWatchPath } from "@/lib/watchPaths";

const Watch = () => {
  const { contentType, contentId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isNative, isIOS, isAndroid } = usePlatform();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState("Access Denied");
  const [retryAttempt, setRetryAttempt] = useState<number | null>(null);
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

  const resolveVideoUrlSafely = async (
    request: Promise<{ data?: any; error?: { message?: string } | null }>,
    fallbackUrl: string | null,
    requestLabel: string,
  ): Promise<{ url: string } | null> => {
    try {
      const { data, error } = await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`${requestLabel} timed out`));
          }, 8000);
        }),
      ]);

      if (error) {
        console.warn(`[Watch] ${requestLabel} failed:`, error);
        return fallbackUrl ? { url: fallbackUrl } : null;
      }

      const raw = data as Record<string, unknown> | null;
      const signedUrl =
        typeof raw?.signedUrl === "string"
          ? raw.signedUrl
          : typeof raw?.data === "object" && raw.data && typeof (raw.data as { signedUrl?: unknown }).signedUrl === "string"
            ? (raw.data as { signedUrl: string }).signedUrl
            : null;

      return signedUrl || fallbackUrl ? { url: signedUrl || fallbackUrl || "" } : null;
    } catch (error) {
      console.warn(`[Watch] ${requestLabel} timed out or failed:`, error);
      return fallbackUrl ? { url: fallbackUrl } : null;
    }
  };

  const checkAccessAndLoad = async (requestId: number) => {
    try {
      if (!guardSetState(requestId)) return;

      let hasAccess = false;
      let retryCount = 0;
      const routeState = location.state as { fromSeasonId?: string } | null;
      const fromSeasonId = routeState?.fromSeasonId;

      // Entitlements may be written slightly after checkout/webhook completes.
      // Season rentals are more prone to this race condition, so we give them
      // a longer retry window before showing Access Denied.
      const isSeasonWatch = contentType === "season";
      const isEpisodeAfterSeasonRedirect =
        contentType === "episode" && !!fromSeasonId;
      const maxRetries = isSeasonWatch || isEpisodeAfterSeasonRedirect ? 12 : 3; // ~6s after checkout vs ~1.5s default
      const baseDelay = 500;

      const {
        data: { session },
      } = await supabase.auth.getSession();
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
        const { data: accessData, error: accessError } =
          await supabase.functions.invoke("rental-access", {
            body: {
              content_id: contentId,
              content_type: contentType,
            },
            headers: { Authorization: `Bearer ${accessToken}` },
          });

        // expose retry progress for UI feedback
        if (guardSetState(requestId)) setRetryAttempt(retryCount + 1);

        const hasAccessNow = (() => {
          if (!accessData || typeof accessData !== "object") return false;
          const row = accessData as Record<string, unknown>;
          return row["has_access"] === true;
        })();

        if (!accessError && hasAccessNow) {
          hasAccess = true;
          break;
        }

        if (contentType === "episode") {
          const seasonId =
            fromSeasonId ||
            (await (async () => {
              const { data: episodeData } = await supabase
                .from("episodes")
                .select("season_id")
                .eq("id", contentId)
                .maybeSingle();
              return episodeData?.season_id || null;
            })());

          if (seasonId) {
            const { data: seasonAccessData, error: seasonAccessError } =
              await supabase.functions.invoke("rental-access", {
                body: {
                  content_id: seasonId,
                  content_type: "season",
                },
                headers: { Authorization: `Bearer ${accessToken}` },
              });

            const hasSeasonAccess =
              !seasonAccessError &&
              !!seasonAccessData &&
              typeof seasonAccessData === "object" &&
              (seasonAccessData as Record<string, unknown>)["has_access"] ===
                true;

            if (hasSeasonAccess) {
              hasAccess = true;
              break;
            }
          }
        }

        retryCount++;
        if (retryCount < maxRetries) {
          // exponential backoff with cap
          const nextDelay = Math.min(
            2000,
            Math.round(baseDelay * Math.pow(1.5, retryCount)),
          );
          await new Promise((resolve) => setTimeout(resolve, nextDelay));
        }
      }

      if (!hasAccess) {
        if (!guardSetState(requestId)) return;
        setErrorTitle("Verification timed out");
        setError(
          "We couldn't confirm your rental yet. You can retry verification or return to the previous page.",
        );
        setLoading(false);
        setRetryAttempt(null);
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
          .select(
            `
            *,
            seasons!inner (
              season_number,
              tv_shows!inner (
                title,
                thumbnail_url
              )
            )
          `,
          )
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

        const resolvedPath = await resolveWatchPath(
          "season",
          contentId,
          user.id,
        );
        navigate(resolvedPath, {
          replace: true,
          state: { fromSeasonId: contentId },
        });
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

      const typedContentData = contentData as { video_url?: string } | null;
      const fallbackUrl = typedContentData?.video_url ?? null;

      if (contentType === "movie") {
        const result = await resolveVideoUrlSafely(
          supabase.functions.invoke("get-video-url", {
            body: { movieId: contentId },
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fallbackUrl,
          "movie stream lookup",
        );

        if (!result) {
          if (!guardSetState(requestId)) return;
          setErrorTitle("Video Unavailable");
          setError("Stream URI resolution failed");
          setLoading(false);
          return;
        }

        videoUrlData = result;
      } else if (contentType === "episode") {
        const result = await resolveVideoUrlSafely(
          supabase.functions.invoke("get-video-url", {
            body: {
              contentId,
              episodeId: contentId,
              contentType: "episode",
              expiryHours: 24,
            },
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fallbackUrl,
          "episode stream lookup",
        );

        if (!result) {
          if (!guardSetState(requestId)) return;
          setErrorTitle("Video Unavailable");
          setError("Secure token generation failed for media stream");
          setLoading(false);
          return;
        }

        videoUrlData = result;
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
      setRetryAttempt(null);
      setLoading(false);
    } catch (err) {
      if (!guardSetState(requestId)) return;
      console.error("Critical crash inside playback thread:", err);
      setErrorTitle("Video Unavailable");
      setError("An unexpected error occurred while setting up the player");
      setLoading(false);
    }
  };

  const manualRetry = () => {
    // bump request id and re-run check
    requestIdRef.current += 1;
    const newRequestId = requestIdRef.current;
    setLoading(true);
    setError(null);
    setErrorTitle("Access Denied");
    setRetryAttempt(null);
    checkAccessAndLoad(newRequestId);
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
          <div className="flex items-center justify-center gap-3">
            {errorTitle === "Verification timed out" ? (
              <>
                <button
                  onClick={manualRetry}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:opacity-90 transition"
                >
                  Retry Verification
                </button>
                <button
                  onClick={() => navigate(-1)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition"
                >
                  Go Back
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition"
              >
                Go Back
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Formatting strings safely out of unified object types
  const typedContent = content as null | {
    title?: string;
    thumbnail_url?: string;
    subtitle_url?: string;
    video_url?: string;
    episode_number?: number | string;
    seasons?: {
      season_number?: number | string;
      tv_shows?: { title?: string; thumbnail_url?: string };
    };
    [key: string]: unknown;
  };

  // Build a clean display title with fallbacks
  let contentTitle = "";
  if (contentType === "movie") {
    contentTitle = typedContent?.title ?? "Untitled Movie";
  } else {
    const showTitle =
      typedContent?.seasons?.tv_shows?.title ??
      (typedContent?.seasons as any)?.title ??
      "Show";
    const seasonNumber = typedContent?.seasons?.season_number ?? "";
    const episodeNumber = typedContent?.episode_number ?? "";
    const episodeTitle = typedContent?.title ?? "Untitled Episode";
    contentTitle = `${showTitle} - S${seasonNumber}E${episodeNumber}: ${episodeTitle}`;
  }

  const contentPoster =
    contentType === "movie"
      ? typedContent?.thumbnail_url ?? ""
      : typedContent?.seasons?.tv_shows?.thumbnail_url ??
        typedContent?.thumbnail_url ??
        "";

  return (
    <div
      ref={fullscreenContainerRef}
      className="min-h-screen bg-black relative group select-none"
    >
      {videoUrl && content && (
        <>
          {/* Native builds use the native player; all web builds use the desktop player */}
          {isNative && (isIOS || isAndroid) ? (
            <NativeVideoPlayer
              contentId={contentId!}
              contentType={contentType as "movie" | "episode"}
              streamUrl={videoUrl}
              title={contentTitle}
              poster={contentPoster}
              autoPlay={true}
            />
          ) : (
            <VideoPlayer
              src={videoUrl}
              contentId={contentId!}
              contentType={contentType as "movie" | "episode"}
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
