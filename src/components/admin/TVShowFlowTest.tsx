import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  TestTube, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  PlayCircle
} from 'lucide-react';

interface TestStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
}

export const TVShowFlowTest = () => {
  const [testing, setTesting] = useState(false);
  const [steps, setSteps] = useState<TestStep[]>([
    { id: 'auth', name: 'Authentication Check', status: 'pending' },
    { id: 'upload-url', name: 'Upload URL Generation', status: 'pending' },
    { id: 'thumbnail-upload', name: 'Thumbnail Upload', status: 'pending' },
    { id: 'trailer-upload', name: 'Trailer Upload', status: 'pending' },
    { id: 'tv-show-creation', name: 'TV Show Creation', status: 'pending' },
  ]);
  const { toast } = useToast();

  const updateStep = (id: string, updates: Partial<TestStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === id ? { ...step, ...updates } : step
    ));
  };

  const createTestFile = (type: 'image' | 'video'): File => {
    const content = type === 'image' 
      ? 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
      : 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAQxtZGF0AAABAGEAYY40bWFubw==';
    
    const byteCharacters = atob(content.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const fileName = type === 'image' ? 'test-poster.jpg' : 'test-trailer.mp4';
    const mimeType = type === 'image' ? 'image/jpeg' : 'video/mp4';
    
    return new File([byteArray], fileName, { type: mimeType });
  };

  const runCompleteTest = async () => {
    setTesting(true);
    
    // Reset all steps
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', message: undefined, duration: undefined })));

    try {
      // Step 1: Authentication Check
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

      // Step 2: Upload URL Generation Test
      updateStep('upload-url', { status: 'running' });
      const startUploadUrl = Date.now();
      
      const { data: uploadUrlData, error: uploadUrlError } = await supabase.functions.invoke('unified-media-upload', {
        body: {
          fileName: 'test-poster.jpg',
          fileType: 'thumbnail',
          contentType: 'image/jpeg'
        }
      });

      if (uploadUrlError || !uploadUrlData?.success) {
        throw new Error(uploadUrlData?.error || uploadUrlError?.message || 'Failed to get upload URL');
      }

      updateStep('upload-url', {
        status: 'success',
        message: 'Upload URL generated successfully',
        duration: Date.now() - startUploadUrl
      });

      // Step 3: Thumbnail Upload Test
      updateStep('thumbnail-upload', { status: 'running' });
      const startThumbnail = Date.now();
      
      const thumbnailFile = createTestFile('image');
      const thumbnailResponse = await fetch(uploadUrlData.uploadUrl, {
        method: 'PUT',
        body: thumbnailFile,
        headers: {
          'Content-Type': 'image/jpeg',
        },
      });

      if (!thumbnailResponse.ok) {
        throw new Error(`Thumbnail upload failed: HTTP ${thumbnailResponse.status}`);
      }

      updateStep('thumbnail-upload', {
        status: 'success',
        message: 'Thumbnail uploaded successfully',
        duration: Date.now() - startThumbnail
      });

      // Step 4: Trailer Upload Test
      updateStep('trailer-upload', { status: 'running' });
      const startTrailer = Date.now();
      
      const { data: trailerUrlData, error: trailerUrlError } = await supabase.functions.invoke('unified-media-upload', {
        body: {
          fileName: 'test-trailer.mp4',
          fileType: 'trailer',
          contentType: 'video/mp4'
        }
      });

      if (trailerUrlError || !trailerUrlData?.success) {
        throw new Error(trailerUrlData?.error || trailerUrlError?.message || 'Failed to get trailer upload URL');
      }

      const trailerFile = createTestFile('video');
      const trailerResponse = await fetch(trailerUrlData.uploadUrl, {
        method: 'PUT',
        body: trailerFile,
        headers: {
          'Content-Type': 'video/mp4',
        },
      });

      if (!trailerResponse.ok) {
        throw new Error(`Trailer upload failed: HTTP ${trailerResponse.status}`);
      }

      updateStep('trailer-upload', {
        status: 'success',
        message: 'Trailer uploaded successfully',
        duration: Date.now() - startTrailer
      });

      // Step 5: TV Show Creation Test
      updateStep('tv-show-creation', { status: 'running' });
      const startTVShow = Date.now();
      
      const formData = new FormData();
      formData.append('title', `Test TV Show ${Date.now()}`);
      formData.append('description', 'This is a test TV show created by the flow tester');
      formData.append('rating', 'PG');
      formData.append('genres', JSON.stringify(['Test', 'Comedy']));
      formData.append('language', 'en');
      formData.append('price', '0');
      formData.append('poster_url', uploadUrlData.publicUrl);
      formData.append('trailer_url', trailerUrlData.publicUrl);

      const tvShowResponse = await fetch(`https://tsfwlereofjlxhjsarap.supabase.co/functions/v1/create-tv-show`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData
      });

      const tvShowResult = await tvShowResponse.json();

      if (!tvShowResponse.ok || !tvShowResult.success) {
        throw new Error(tvShowResult.error || `TV Show creation failed: HTTP ${tvShowResponse.status}`);
      }

      updateStep('tv-show-creation', {
        status: 'success',
        message: `TV Show created: ${tvShowResult.tvShow.title}`,
        duration: Date.now() - startTVShow
      });

      toast({
        title: "Complete Test Successful!",
        description: "All TV show upload flow components are working correctly",
      });

    } catch (error) {
      console.error('TV Show flow test error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Find the currently running step and mark it as error
      const runningStep = steps.find(step => step.status === 'running');
      if (runningStep) {
        updateStep(runningStep.id, {
          status: 'error',
          message: errorMessage
        });
      }

      toast({
        title: "Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const getStepIcon = (status: TestStep['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'running': return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      default: return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />;
    }
  };

  const getStepBadge = (status: TestStep['status']) => {
    switch (status) {
      case 'success': return <Badge variant="default">✓ Pass</Badge>;
      case 'error': return <Badge variant="destructive">✗ Fail</Badge>;
      case 'running': return <Badge variant="secondary">Running...</Badge>;
      default: return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          TV Show Complete Flow Test
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Test the complete TV show creation flow from authentication to database creation
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button 
          onClick={runCompleteTest} 
          disabled={testing}
          className="w-full flex items-center gap-2"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          {testing ? 'Running Complete Test...' : 'Run Complete Flow Test'}
        </Button>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                  {index + 1}
                </div>
                {getStepIcon(step.status)}
                <div>
                  <p className="text-sm font-medium">{step.name}</p>
                  {step.message && (
                    <p className="text-xs text-muted-foreground">{step.message}</p>
                  )}
                  {step.duration && (
                    <p className="text-xs text-muted-foreground">{step.duration}ms</p>
                  )}
                </div>
              </div>
              {getStepBadge(step.status)}
            </div>
          ))}
        </div>

        {steps.every(step => step.status === 'success') && !testing && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950 dark:border-green-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  🎉 Complete Flow Test Passed!
                </p>
                <p className="text-xs text-green-600 dark:text-green-500">
                  TV show upload flow is fully functional and ready for production use.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};