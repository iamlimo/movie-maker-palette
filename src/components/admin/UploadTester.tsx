import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Image,
  Video
} from 'lucide-react';

interface TestResult {
  type: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  url?: string;
  duration?: number;
}

export const UploadTester = () => {
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

  const testFiles = [
    { 
      name: 'poster.jpg', 
      type: 'poster', 
      content: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
    },
    { 
      name: 'trailer.mp4', 
      type: 'trailer', 
      content: 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAQxtZGF0AAABAGEAYY40bWFubw=='
    }
  ];

  const createTestFile = (name: string, content: string): File => {
    const byteCharacters = atob(content.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new File([byteArray], name, { 
      type: content.startsWith('data:image/') ? 'image/jpeg' : 'video/mp4' 
    });
  };

  const testUpload = async (file: File, type: string): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      // Test authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      // Test signed URL generation
      const { data: signedData, error: signedError } = await supabase.functions.invoke('file-upload', {
        method: 'GET',
        body: null,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (signedError) {
        throw new Error(`Signed URL error: ${signedError.message}`);
      }

      // Test direct upload
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('file-upload', {
        method: 'POST',
        body: file,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': file.type,
        },
      });

      if (uploadError) {
        throw new Error(`Upload error: ${uploadError.message}`);
      }

      if (!uploadData?.success) {
        throw new Error(uploadData?.error || 'Upload failed');
      }

      const duration = Date.now() - startTime;
      
      return {
        type,
        status: 'success',
        message: `Upload successful in ${duration}ms`,
        url: uploadData.url,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        type,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  };

  const runTests = async () => {
    setTesting(true);
    setProgress(0);
    setResults([]);

    const totalTests = testFiles.length;
    
    for (let i = 0; i < testFiles.length; i++) {
      const testFile = testFiles[i];
      setProgress((i / totalTests) * 100);
      
      const file = createTestFile(testFile.name, testFile.content);
      const result = await testUpload(file, testFile.type);
      
      setResults(prev => [...prev, result]);
      
      if (result.status === 'success') {
        toast({
          title: "Test Passed",
          description: `${testFile.type} upload successful`,
        });
      } else {
        toast({
          title: "Test Failed", 
          description: `${testFile.type}: ${result.message}`,
          variant: "destructive",
        });
      }
    }
    
    setProgress(100);
    setTesting(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-600" />;
      default: return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
    }
  };

  const getTypeIcon = (type: string) => {
    return type.includes('poster') || type.includes('thumbnail') 
      ? <Image className="h-4 w-4" />
      : <Video className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Flow Tester
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Test media upload functionality before building TV Shows features
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={runTests} 
              disabled={testing}
              className="flex items-center gap-2"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {testing ? 'Testing...' : 'Run Upload Tests'}
            </Button>
          </div>

          {testing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                Testing uploads... {Math.round(progress)}%
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Test Results</h4>
              {results.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getTypeIcon(result.type)}
                    <div>
                      <p className="text-sm font-medium capitalize">{result.type}</p>
                      <p className="text-xs text-muted-foreground">{result.message}</p>
                      {result.duration && (
                        <p className="text-xs text-muted-foreground">{result.duration}ms</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                      {result.status}
                    </Badge>
                    {getStatusIcon(result.status)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.length > 0 && !testing && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-green-600 font-medium">
                    {results.filter(r => r.status === 'success').length} Passed
                  </span>
                </div>
                <div>
                  <span className="text-red-600 font-medium">
                    {results.filter(r => r.status === 'error').length} Failed
                  </span>
                </div>
              </div>
              {results.every(r => r.status === 'success') && (
                <p className="text-green-600 font-medium mt-2">
                  ✅ All tests passed! Ready to build TV Shows features.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};