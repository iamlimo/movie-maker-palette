import { useState, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera as CameraIcon, Loader2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProfileImagePickerProps {
  currentImageUrl?: string;
  userName?: string;
  onImageSelected: (file: File) => Promise<string | null>;
  isUploading?: boolean;
}

// Helper to convert base64 to File
const base64ToFile = (base64: string, filename: string): File => {
  const arr = base64.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

// Helper to compress image
const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export const ProfileImagePicker = ({
  currentImageUrl,
  userName,
  onImageSelected,
  isUploading = false,
}: ProfileImagePickerProps) => {
  const [localUploading, setLocalUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploading = isUploading || localUploading;

  const handleNativeImagePick = async () => {
    try {
      setLocalUploading(true);

      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt,
        promptLabelHeader: 'Profile Photo',
        promptLabelPhoto: 'Choose from Gallery',
        promptLabelPicture: 'Take Photo',
      });

      if (photo.base64String) {
        const base64Data = `data:image/${photo.format || 'jpeg'};base64,${photo.base64String}`;
        const file = base64ToFile(base64Data, `profile.${photo.format || 'jpg'}`);
        
        // Compress if larger than 1MB
        const finalFile = file.size > 1024 * 1024 ? await compressImage(file) : file;
        
        await onImageSelected(finalFile);
      }
    } catch (error: any) {
      // User cancelled - don't show error
      if (error?.message?.includes('User cancelled') || error?.message?.includes('cancelled')) {
        console.log('User cancelled image selection');
        return;
      }
      
      console.error('Error picking image:', error);
      toast({
        title: 'Error',
        description: 'Failed to select image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLocalUploading(false);
    }
  };

  const handleWebImagePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 10MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLocalUploading(true);
      
      // Compress if larger than 1MB
      const finalFile = file.size > 1024 * 1024 ? await compressImage(file) : file;
      
      await onImageSelected(finalFile);
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: 'Error',
        description: 'Failed to process image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLocalUploading(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    if (uploading) return;

    if (Capacitor.isNativePlatform()) {
      handleNativeImagePick();
    } else {
      fileInputRef.current?.click();
    }
  };

  const initials = userName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative inline-block">
      <Avatar className="h-24 w-24 cursor-pointer border-4 border-primary/20" onClick={handleClick}>
        <AvatarImage src={currentImageUrl} alt={userName || 'Profile'} />
        <AvatarFallback className="bg-primary/10 text-primary text-xl">
          {initials || <User className="h-8 w-8" />}
        </AvatarFallback>
      </Avatar>

      <Button
        size="icon"
        variant="secondary"
        className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-lg"
        onClick={handleClick}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CameraIcon className="h-4 w-4" />
        )}
      </Button>

      {/* Hidden file input for web fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleWebImagePick}
      />
    </div>
  );
};
