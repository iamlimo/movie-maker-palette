import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, TestTube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TestStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
}

const EpisodeUploadTest = () => {
  const [steps, setSteps] = useState<TestStep[]>([
    { id: 'auth', name: 'User Authentication', status: 'pending' },
    { id: 'video-url', name: 'Video Upload URL Generation', status: 'pending' },
    { id: 'thumbnail-url', name: 'Thumbnail Upload URL Generation', status: 'pending' },
    { id: 'trailer-url', name: 'Trailer Upload URL Generation', status: 'pending' },
    { id: 'buckets', name: 'Storage Bucket Verification', status: 'pending' }
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const updateStep = (id: string, updates: Partial<TestStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === id ? { ...step, ...updates } : step
    ));
  };

  const runTests = async () => {
    setIsRunning(true);
    
    try {
      // Test 1: Authentication
      updateStep('auth', { status: 'running' });
      const startAuth = Date.now();
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }
      
      updateStep('auth', { 
        status: 'success', 
        message: 'Authenticated successfully',
        duration: Date.now() - startAuth
      });

      // Test 2: Video Upload URL
      updateStep('video-url', { status: 'running' });
      const startVideo = Date.now();
      
      const { data: videoUrlData, error: videoUrlError } = await supabase.functions.invoke('unified-media-upload', {
        body: {
          fileName: 'test-video.mp4',
          fileType: 'episode-video',
          contentType: 'episode-video'
        }
      });

      if (videoUrlError || !videoUrlData?.success) {
        throw new Error(videoUrlData?.error || videoUrlError?.message || 'Failed to get video upload URL');
      }

      updateStep('video-url', {
        status: 'success',
        message: `Video upload URL generated (bucket: ${videoUrlData.bucket})`,
        duration: Date.now() - startVideo
      });

      // Test 3: Thumbnail Upload URL
      updateStep('thumbnail-url', { status: 'running' });
      const startThumbnail = Date.now();
      
      const { data: thumbnailUrlData, error: thumbnailUrlError } = await supabase.functions.invoke('unified-media-upload', {
        body: {
          fileName: 'test-thumbnail.jpg',
          fileType: 'episode-thumbnail',
          contentType: 'episode-thumbnail'
        }
      });

      if (thumbnailUrlError || !thumbnailUrlData?.success) {
        throw new Error(thumbnailUrlData?.error || thumbnailUrlError?.message || 'Failed to get thumbnail upload URL');
      }

      updateStep('thumbnail-url', {
        status: 'success',
        message: `Thumbnail upload URL generated (bucket: ${thumbnailUrlData.bucket})`,
        duration: Date.now() - startThumbnail
      });

      // Test 4: Trailer Upload URL
      updateStep('trailer-url', { status: 'running' });
      const startTrailer = Date.now();
      
      const { data: trailerUrlData, error: trailerUrlError } = await supabase.functions.invoke('unified-media-upload', {
        body: {
          fileName: 'test-trailer.mp4',
          fileType: 'episode-trailer',
          contentType: 'episode-trailer'
        }
      });

      if (trailerUrlError || !trailerUrlData?.success) {
        throw new Error(trailerUrlData?.error || trailerUrlError?.message || 'Failed to get trailer upload URL');
      }

      updateStep('trailer-url', {
        status: 'success',
        message: `Trailer upload URL generated (bucket: ${trailerUrlData.bucket})`,
        duration: Date.now() - startTrailer
      });

      // Test 5: Verify buckets exist
      updateStep('buckets', { status: 'running' });
      const startBuckets = Date.now();
      
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (bucketsError) {
        throw new Error(`Failed to list buckets: ${bucketsError.message}`);
      }

      const requiredBuckets = ['videos', 'thumbnails', 'tv-trailers'];
      const existingBuckets = buckets.map(b => b.name);
      const missingBuckets = requiredBuckets.filter(b => !existingBuckets.includes(b));
      
      if (missingBuckets.length > 0) {
        throw new Error(`Missing buckets: ${missingBuckets.join(', ')}`);
      }

      updateStep('buckets', {
        status: 'success',
        message: `All required buckets exist: ${requiredBuckets.join(', ')}`,
        duration: Date.now() - startBuckets
      });

      toast({
        title: "All tests passed!",
        description: "Episode upload system is working correctly",
      });

    } catch (error) {
      console.error('Test failed:', error);
      const currentStep = steps.find(s => s.status === 'running');
      if (currentStep) {
        updateStep(currentStep.id, {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      toast({
        title: "Test failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusBadge = (status: TestStep['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Running...</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Episode Upload System Test
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Test the episode media upload functionality to ensure everything is working correctly
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Button onClick={runTests} disabled={isRunning} className="w-full sm:w-auto">
            {isRunning ? 'Running Tests...' : 'Run Tests'}
          </Button>
        </div>

        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium">{step.name}</h3>
                  {getStatusBadge(step.status)}
                </div>
                {step.message && (
                  <p className="text-sm text-muted-foreground">{step.message}</p>
                )}
              </div>
              {step.duration && (
                <div className="text-xs text-muted-foreground">
                  {step.duration}ms
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default EpisodeUploadTest;