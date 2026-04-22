/**
 * Hook to detect and warn about suspicious browser extensions
 * Helps identify extensions that might be interfering with the app or stealing data
 */

import { useEffect, useState, useCallback } from 'react';

interface ExtensionDetectionResult {
  isSuspicious: boolean;
  extensions: SuspiciousExtensionInfo[];
  warnings: string[];
}

interface SuspiciousExtensionInfo {
  name: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * List of known suspicious extension signatures
 */
const SUSPICIOUS_PATTERNS = [
  // Known malware/adware signatures
  {
    name: 'Content Injector',
    patterns: ['__CONTENT_INJECTOR__', 'contentInjector'],
    reason: 'Detected content injection script - possible malware',
    severity: 'high' as const,
  },
  {
    name: 'Script Modifier',
    patterns: ['__SCRIPT_MODIFIED__', 'scriptModified'],
    reason: 'Detected script modification - possible data theft',
    severity: 'high' as const,
  },
  {
    name: 'DOM Spy',
    patterns: ['__DOM_SPY__', 'domSpy', 'domMonitor'],
    reason: 'Detected DOM monitoring extension',
    severity: 'high' as const,
  },
  {
    name: 'Network Interceptor',
    patterns: ['__NETWORK_INTERCEPT__', 'networkSpy'],
    reason: 'Detected network traffic interception',
    severity: 'high' as const,
  },
];

export const useExtensionDetection = () => {
  const [detectionResult, setDetectionResult] = useState<ExtensionDetectionResult>({
    isSuspicious: false,
    extensions: [],
    warnings: [],
  });

  const detectInjectedScripts = useCallback((): SuspiciousExtensionInfo[] => {
    const detected: SuspiciousExtensionInfo[] = [];

    // Check for injected global variables
    const globalScope = typeof window !== 'undefined' ? window : {};
    for (const pattern of SUSPICIOUS_PATTERNS) {
      for (const sig of pattern.patterns) {
        if (sig in globalScope || (globalScope as Record<string, any>)[sig]) {
          detected.push({
            name: pattern.name,
            reason: pattern.reason,
            severity: pattern.severity,
          });
        }
      }
    }

    return detected;
  }, []);

  const checkDOMModifications = useCallback((): string[] => {
    const warnings: string[] = [];

    // Check if document.write has been overridden (common in malware)
    if (document.write.toString().includes('[native code]') === false) {
      warnings.push('⚠️ document.write appears to be modified');
    }

    // Check for unusual event listeners
    const testElement = document.createElement('div');
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    let isModified = false;

    try {
      if (originalAddEventListener.toString().includes('[native code]') === false) {
        isModified = true;
        warnings.push('⚠️ addEventListener appears to be hooked');
      }
    } catch (e) {
      // Ignore
    }

    // Check for overridden Fetch API
    if (typeof fetch !== 'undefined') {
      if (fetch.toString().includes('[native code]') === false) {
        warnings.push('⚠️ Fetch API appears to be intercepted');
      }
    }

    // Check for XHR modifications
    if (XMLHttpRequest.prototype.open.toString().includes('[native code]') === false) {
      warnings.push('⚠️ XMLHttpRequest appears to be intercepted');
    }

    return warnings;
  }, []);

  const checkNetworkRequests = useCallback((): string[] => {
    const warnings: string[] = [];

    // Monitor for suspicious headers in requests
    const originalFetch = window.fetch;
    let suspiciousRequestDetected = false;

    const wrappedFetch = async (...args: any[]) => {
      try {
        // Check if request is being modified
        const url = args[0];
        const options = args[1] || {};

        // Look for unusual headers
        const headers = options.headers || {};
        const headerKeys = Object.keys(headers);

        if (headerKeys.some((key) => key.startsWith('X-Injected-'))) {
          suspiciousRequestDetected = true;
          warnings.push('⚠️ Detected injected request headers');
        }
      } catch (e) {
        // Ignore
      }

      return originalFetch.apply(window, args);
    };

    // Don't actually wrap fetch to avoid breaking the app
    // Just log suspicious patterns for monitoring

    return warnings;
  }, []);

  const checkStorageAccess = useCallback((): string[] => {
    const warnings: string[] = [];

    // Check for localStorage access attempts
    const testKey = '__SECURITY_CHECK_' + Date.now();
    const testValue = 'security_check';

    try {
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);

      if (retrieved !== testValue) {
        warnings.push('⚠️ localStorage appears to be intercepted or modified');
      }

      localStorage.removeItem(testKey);
    } catch (e) {
      warnings.push('⚠️ localStorage access is being blocked or intercepted');
    }

    return warnings;
  }, []);

  const checkIFrameAccess = useCallback((): string[] => {
    const warnings: string[] = [];

    try {
      // Check if iframes can access parent
      if (typeof window !== 'undefined' && window !== window.top) {
        if (window.top) {
          // We're in an iframe
          warnings.push('⚠️ Application is running inside an iframe - verify this is intentional');
        }
      }
    } catch (e) {
      // Cross-origin iframe, ignore
    }

    return warnings;
  }, []);

  const performDetailedScan = useCallback((): void => {
    const extensionFindings: SuspiciousExtensionInfo[] = [];
    const allWarnings: string[] = [];

    // Run all checks
    extensionFindings.push(...detectInjectedScripts());
    allWarnings.push(...checkDOMModifications());
    allWarnings.push(...checkNetworkRequests());
    allWarnings.push(...checkStorageAccess());
    allWarnings.push(...checkIFrameAccess());

    const isSuspicious = extensionFindings.length > 0 || allWarnings.length > 0;

    setDetectionResult({
      isSuspicious,
      extensions: extensionFindings,
      warnings: allWarnings,
    });

    // Log findings to console for debugging
    if (isSuspicious) {
      console.warn('🚨 Security Issue Detected:', {
        extensions: extensionFindings,
        warnings: allWarnings,
      });
    }
  }, [detectInjectedScripts, checkDOMModifications, checkNetworkRequests, checkStorageAccess, checkIFrameAccess]);

  useEffect(() => {
    // Run initial detection
    performDetailedScan();

    // Re-run detection periodically to catch new injections
    const detectionInterval = setInterval(() => {
      performDetailedScan();
    }, 30000); // Every 30 seconds

    return () => clearInterval(detectionInterval);
  }, [performDetailedScan]);

  return {
    ...detectionResult,
    performDetailedScan,
  };
};

/**
 * Hook to log suspicious activity
 */
export const useSecurityLogger = () => {
  const logSuspiciousActivity = useCallback((activity: {
    type: 'extension_detected' | 'xss_attempt' | 'network_anomaly' | 'storage_access' | 'other';
    details: Record<string, any>;
    timestamp: string;
    userAgent: string;
  }) => {
    try {
      // In production, send this to your monitoring service
      console.error('[SECURITY LOG]', {
        ...activity,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      });

      // Send to your analytics/monitoring endpoint
      if (window.location.hostname === 'signaturetv.co') {
        // Only send from production
        fetch('https://signaturetv.co/api/security-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activity),
        }).catch(console.error);
      }
    } catch (error) {
      console.error('Failed to log security activity:', error);
    }
  }, []);

  return { logSuspiciousActivity };
};

/**
 * Quick extension detection utility
 * Can be called independently to check current state
 */
export const quickExtensionScan = (): {
  found: boolean;
  count: number;
  details: string[];
} => {
  const details: string[] = [];
  const globalScope = typeof window !== 'undefined' ? window : {};

  // Quick check for common injection markers
  const markers = [
    '__CONTENT_INJECTOR__',
    '__SCRIPT_MODIFIED__',
    '__DOM_SPY__',
    '__NETWORK_INTERCEPT__',
    '__INJECTED__',
    '__EXTENSION__',
    'webpackChunk__extensions',
    'chrome',
  ];

  const found = markers.filter((marker) => {
    if (marker in globalScope || (globalScope as Record<string, any>)[marker]) {
      details.push(`Found marker: ${marker}`);
      return true;
    }
    return false;
  });

  return {
    found: found.length > 0,
    count: found.length,
    details,
  };
};

export default {
  useExtensionDetection,
  useSecurityLogger,
  quickExtensionScan,
};
