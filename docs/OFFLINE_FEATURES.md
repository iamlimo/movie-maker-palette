# Offline Features & Service Worker

## Overview

Signature TV now includes comprehensive offline capabilities powered by a service worker and background sync. This ensures a smooth experience even when connectivity is poor or unavailable.

## Features

### 1. **Smart Caching**

The app automatically caches different types of content with optimal strategies:

- **Static Assets** (JS, CSS, HTML): Cached indefinitely for instant loading
- **Images & Posters**: Cache-first strategy, stored for 30 days (1000 max entries)
- **Supabase API Calls**: Network-first with 5-minute cache fallback (100 max entries)
- **Supabase Storage**: Cache-first strategy, stored for 7 days (500 max entries)
- **Fonts**: Cached for 1 year (20 max entries)

### 2. **Automatic Updates**

The service worker checks for updates every hour and prompts users when a new version is available. Users can update immediately via the toast notification.

### 3. **Background Sync**

When offline, certain operations are queued and automatically synced when connectivity is restored:

- Adding/removing favorites
- Rental transactions
- Watch progress tracking
- Wallet operations

**How it works:**
1. User performs an action while offline
2. Action is queued in localStorage
3. When connection is restored, the queue is automatically processed
4. Failed operations are retried up to 3 times
5. Visual indicator shows sync status

### 4. **Online/Offline Detection**

The app monitors connection status and:
- Shows toast notifications when connection changes
- Displays a sync status badge in the bottom-right corner
- Queues operations for background sync when offline

## Technical Implementation

### Service Worker Configuration

Located in `vite.config.ts`:

```typescript
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    runtimeCaching: [
      // API calls: Network-first with 5-minute cache
      {
        urlPattern: /supabase\.co\/rest\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-api-cache',
          expiration: { maxEntries: 100, maxAgeSeconds: 300 }
        }
      },
      // Images: Cache-first with 30-day storage
      {
        urlPattern: /\.(jpg|jpeg|png|gif|webp|svg)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images-cache',
          expiration: { maxEntries: 1000, maxAgeSeconds: 2592000 }
        }
      }
    ]
  }
})
```

### Background Sync Manager

The `backgroundSync` manager (`src/lib/backgroundSync.ts`) handles offline operations:

```typescript
import { backgroundSync } from '@/lib/backgroundSync';

// Queue an operation for background sync
backgroundSync.addTask('favorite', {
  action: 'add',
  favorite: { user_id, content_id, content_type }
});

// Check pending tasks
const pendingCount = backgroundSync.getPendingCount();
```

### Service Worker Hook

Use the `useServiceWorker` hook to access offline features:

```typescript
import { useServiceWorker } from '@/hooks/useServiceWorker';

function MyComponent() {
  const { isOnline, needRefresh, updateServiceWorker } = useServiceWorker();
  
  return (
    <div>
      {!isOnline && <p>You're offline</p>}
      {needRefresh && <button onClick={updateServiceWorker}>Update App</button>}
    </div>
  );
}
```

## PWA Installation

### On Mobile Devices

**iOS (Safari):**
1. Open the app in Safari
2. Tap the Share button
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

**Android (Chrome):**
1. Open the app in Chrome
2. Tap the menu (three dots)
3. Tap "Add to Home Screen"
4. Tap "Add"

### Desktop

**Chrome/Edge:**
1. Look for the install icon in the address bar
2. Click "Install"
3. The app opens in its own window

## Performance Impact

### Cache Limits
- **Images**: 1000 entries (~500MB - 1GB)
- **API responses**: 100 entries (~5-10MB)
- **Storage assets**: 500 entries (~100-200MB)
- **Total estimated**: ~600MB - 1.2GB

### Auto-Cleanup
- Outdated caches are automatically cleaned
- LRU (Least Recently Used) eviction for cache overflow
- Service worker updates clean old versions

## Testing Offline Features

### Chrome DevTools
1. Open DevTools (F12)
2. Go to "Application" tab
3. Select "Service Workers"
4. Check "Offline" to simulate no connection
5. Interact with the app and observe queued operations

### Network Throttling
1. Open DevTools Network tab
2. Select "Slow 3G" or "Offline" from the throttling dropdown
3. Test app behavior with poor connectivity

## Troubleshooting

### Clear Cache
If experiencing issues:
1. Open DevTools → Application → Storage
2. Click "Clear site data"
3. Refresh the page

### Force Service Worker Update
```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(registration => registration.unregister());
});
```

### View Background Sync Queue
```javascript
// In browser console
const queue = localStorage.getItem('signature-tv-sync-queue');
console.log(JSON.parse(queue));
```

## Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 15.4+
- ✅ Samsung Internet 14+
- ✅ Opera 76+

## Best Practices

1. **Always test offline scenarios** during development
2. **Monitor cache sizes** to avoid excessive storage usage
3. **Handle sync failures gracefully** with user feedback
4. **Keep background sync tasks lightweight** to avoid performance issues
5. **Clear old caches** when deploying major updates

## Next Steps

Consider implementing:
- [ ] Selective content pre-caching for downloaded movies
- [ ] Progressive Web App installation prompt
- [ ] Background fetch for large video files
- [ ] Push notifications for rental expirations
- [ ] Periodic background sync for content updates

## Resources

- [Workbox Documentation](https://developer.chrome.com/docs/workbox/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Background Sync](https://developer.chrome.com/docs/capabilities/periodic-background-sync)
- [PWA Best Practices](https://web.dev/pwa/)
