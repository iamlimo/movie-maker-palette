import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VideoPlayer } from "@/components/VideoPlayer";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const Watch = () => {
  const { contentType, contentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!contentType || !contentId) {
      setError("Invalid content");
      setLoading(false);
      return;
    }

    checkAccessAndLoad();
  }, [user, contentType, contentId, navigate]);

  const checkAccessAndLoad = async () => {
    try {
      // Check rental access
      const { data: accessData, error: accessError } = await supabase.functions.invoke("rental-access", {
        body: { content_id: contentId, content_type: contentType }
      });

      if (accessError || !accessData?.has_access) {
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
          .select("*, seasons(shows(title, slug))")
          .eq("id", contentId)
          .single();
        contentData = data;
      }

      if (!contentData) {
        setError("Content not found");
        setLoading(false);
        return;
      }

      setContent(contentData);

      // Get video URL based on content type
      let videoUrlData: any;
      
      if (contentType === "movie") {
        // Use get-video-url function for movies (generates signed URL)
        const { data: urlData, error: urlError } = await supabase.functions.invoke("get-video-url", {
          body: { movieId: contentId }
        });
        
        if (urlError || !urlData?.url) {
          // Fallback to direct URL from database
          videoUrlData = { url: contentData.video_url };
        } else {
          videoUrlData = urlData;
        }
      } else if (contentType === "episode") {
        // For episodes, use direct video URL from database
        videoUrlData = { url: contentData.video_url };
      }

      if (!videoUrlData?.url) {
        setError("Failed to load video");
        setLoading(false);
        return;
      }

      setVideoUrl(videoUrlData.url);
      setLoading(false);
    } catch (err: any) {
      console.error("Error loading content:", err);
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
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
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
    <div className="min-h-screen bg-black">
      {videoUrl && content && (
        <VideoPlayer
          src={videoUrl}
          contentId={contentId!}
          contentType={contentType!}
          title={contentType === "movie" ? content.title : `${content.seasons.shows.title} - Episode ${content.episode_number}`}
          poster={content.poster_url}
          autoPlay={true}
          immersive={true}
        />
      )}
    </div>
  );
};

export default Watch;