import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import SecureVideoPreview from './SecureVideoPreview';

interface BackblazeUrlInputProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  required?: boolean;
}

const BackblazeUrlInput = ({ 
  value, 
  onChange, 
  label = "Backblaze Video URL",
  required = true 
}: BackblazeUrlInputProps) => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [showPreview, setShowPreview] = useState(false);

  const validateUrl = (url: string) => {
    if (!url) return false;
    
    // Check if URL contains Backblaze B2 domain or is a valid file path
    const isB2Url = url.includes('backblazeb2.com') || url.includes('b2cdn.com');
    const isFilePath = url.endsWith('.mp4') || url.endsWith('.mov') || 
                       url.endsWith('.avi') || url.endsWith('.mkv') || 
                       url.endsWith('.webm');
    
    return isB2Url || isFilePath;
  };

  const handleUrlChange = (newUrl: string) => {
    onChange(newUrl);
    setShowPreview(false);
    
    if (newUrl) {
      const isValid = validateUrl(newUrl);
      setValidationStatus(isValid ? 'valid' : 'invalid');
    } else {
      setValidationStatus('idle');
    }
  };

  const handleTestVideo = () => {
    if (validationStatus === 'valid') {
      setShowPreview(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="video-url">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="flex gap-2">
          <Input
            id="video-url"
            type="text"
            placeholder="Paste Backblaze B2 file URL or path (e.g., videos/movie.mp4)"
            value={value}
            onChange={(e) => handleUrlChange(e.target.value)}
            className="flex-1"
            required={required}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleTestVideo}
            disabled={validationStatus !== 'valid' || isValidating}
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Test Video'
            )}
          </Button>
        </div>

        {validationStatus === 'valid' && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              URL format is valid
            </AlertDescription>
          </Alert>
        )}

        {validationStatus === 'invalid' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Invalid URL format. Please provide a valid Backblaze B2 URL or file path ending in .mp4, .mov, .avi, .mkv, or .webm
            </AlertDescription>
          </Alert>
        )}

        <p className="text-sm text-muted-foreground">
          Enter the Backblaze B2 file path (e.g., "videos/movie.mp4") or full URL. 
          Videos should be uploaded to your Backblaze bucket manually before pasting the URL here.
        </p>
      </div>

      {showPreview && value && (
        <div className="border rounded-lg p-4 bg-muted/50">
          <h4 className="text-sm font-medium mb-3">Video Preview</h4>
          <SecureVideoPreview url={value} />
        </div>
      )}
    </div>
  );
};

export default BackblazeUrlInput;
