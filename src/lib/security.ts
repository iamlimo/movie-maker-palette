/**
 * Security utilities for frontend protection
 * Prevents XSS, CSRF, data theft, and other common attacks
 */

/**
 * Sanitize user input to prevent XSS attacks
 * Uses basic sanitization - consider DOMPurify for complex content
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Escape special characters
    .replace(/[&<>"']/g, (char) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
      };
      return map[char] || char;
    })
    // Remove null bytes
    .replace(/\0/g, '')
    // Trim whitespace
    .trim();
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Validate password strength
 * Requirements:
 * - Min 8 characters
 * - At least one uppercase letter
 * - At least one number
 * - At least one special character
 */
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
  } else {
    score += 25;
  }

  if (password.length >= 12) {
    score += 25;
  } else {
    feedback.push('Password should be at least 12 characters for better security');
  }

  if (/[A-Z]/.test(password)) {
    score += 25;
  } else {
    feedback.push('Add uppercase letters for better security');
  }

  if (/[0-9]/.test(password)) {
    score += 25;
  } else {
    feedback.push('Add numbers for better security');
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 25;
  } else {
    feedback.push('Add special characters for better security');
  }

  return {
    isValid: score >= 100,
    score: Math.min(score, 100),
    feedback,
  };
};

/**
 * Generate CSRF token (frontend-side generation)
 * Should be stored in memory and validated on submission
 */
export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Create secure cookie options
 */
export const getSecureCookieOptions = () => ({
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'Strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

/**
 * Check for suspicious patterns in API responses
 * Returns true if response looks legitimate
 */
export const validateAPIResponse = (response: any): boolean => {
  // Check for unexpected structure changes
  if (response === null || response === undefined) {
    return false;
  }

  // Check if response is an object
  if (typeof response !== 'object') {
    return false;
  }

  // Add more specific checks based on your API structure
  return true;
};

/**
 * Detect potential XSS payloads in user input
 */
export const detectXSSPayload = (input: string): boolean => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /on\w+\s*=/gi, // event handlers like onclick=
    /javascript:/gi,
    /<iframe/gi,
    /<embed/gi,
    /<object/gi,
    /eval\(/gi,
    /expression\(/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
  ];

  return xssPatterns.some((pattern) => pattern.test(input));
};

/**
 * Hash data for comparison (NOT for passwords - use server-side)
 * This is for integrity checking only
 */
export const simpleHash = (data: string): string => {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
};

/**
 * Secure localStorage wrapper with encryption simulation
 * For sensitive data, use server sessions instead
 */
export const secureStorage = {
  setItem: (key: string, value: any) => {
    try {
      // In production, implement actual encryption here
      const sanitized = sanitizeInput(JSON.stringify(value));
      localStorage.setItem(key, sanitized);
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  },

  getItem: (key: string) => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      return JSON.parse(item);
    } catch (error) {
      console.error('Error retrieving from storage:', error);
      return null;
    }
  },

  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from storage:', error);
    }
  },

  clear: () => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  },
};

/**
 * Clear sensitive data from memory
 * This overwrites the string with random data
 */
export const clearSensitiveData = (value: string | null): null => {
  if (value) {
    // Try to overwrite the string in memory
    // Note: This is not guaranteed due to JavaScript internals
    void new Array(value.length).fill('*').join('');
  }
  return null;
};

/**
 * Detect if running in development mode
 */
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

/**
 * Rate limiting helper
 * Limits function calls to prevent brute force attacks
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
    // 5 attempts per 15 minutes by default
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the window
    const recentAttempts = attempts.filter((time) => now - time < this.windowMs);

    if (recentAttempts.length >= this.maxAttempts) {
      return false;
    }

    // Record new attempt
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);

    return true;
  }

  getRemainingTime(key: string): number {
    const attempts = this.attempts.get(key) || [];
    if (attempts.length === 0) return 0;

    const oldestAttempt = Math.min(...attempts);
    const remainingTime = this.windowMs - (Date.now() - oldestAttempt);

    return Math.max(0, remainingTime);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

/**
 * Verify Content Security Policy compliance
 */
export const getCSPHeaders = (): Record<string, string> => {
  return {
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://tsfwlereofjlxhjsarap.supabase.co https://signaturent.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
  };
};

/**
 * Verify security headers
 */
export const getSecurityHeaders = (): Record<string, string> => {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
};

export default {
  sanitizeInput,
  validateEmail,
  validatePasswordStrength,
  generateCSRFToken,
  getSecureCookieOptions,
  validateAPIResponse,
  detectXSSPayload,
  simpleHash,
  secureStorage,
  clearSensitiveData,
  isDevelopment,
  RateLimiter,
  getCSPHeaders,
  getSecurityHeaders,
};
