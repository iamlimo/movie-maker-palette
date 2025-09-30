/**
 * Validates if a URL is a valid Backblaze B2 URL or file path
 */
export const validateBackblazeUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Check if it's a Backblaze B2 URL
  const isB2Url = url.includes('backblazeb2.com') || url.includes('b2cdn.com');
  
  // Check if it's a valid file path with video extension
  const validExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv'];
  const hasValidExtension = validExtensions.some(ext => url.toLowerCase().endsWith(ext));
  
  // Must be either a B2 URL or a valid file path
  return isB2Url || hasValidExtension;
};

/**
 * Extracts the file path from a Backblaze URL
 */
export const extractB2FilePath = (url: string): string => {
  try {
    // If it's already a file path, return as-is
    if (!url.includes('://')) {
      return url;
    }

    // Parse URL and extract path
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Remove empty strings and 'file' prefix if present
    const cleanParts = pathParts.filter(part => part && part !== 'file');
    
    // Skip bucket name (first part) and return the rest
    return cleanParts.slice(1).join('/');
  } catch (error) {
    console.error('Error extracting B2 file path:', error);
    return url;
  }
};

/**
 * Sanitizes user input to prevent injection attacks
 */
export const sanitizeVideoUrl = (url: string): string => {
  if (!url) return '';
  
  // Remove any potentially dangerous characters
  return url.trim()
    .replace(/[<>'"]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '');
};
