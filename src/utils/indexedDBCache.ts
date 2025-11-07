// IndexedDB helper for offline caching with video blob storage
const DB_NAME = 'signature-tv-cache';
const DB_VERSION = 2;
const METADATA_STORE = 'watched-content';
const VIDEO_STORE = 'cached-videos';
const MAX_CACHE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB limit

interface CachedContent {
  id: string;
  contentType: 'movie' | 'episode';
  title: string;
  thumbnail_url?: string;
  duration?: number;
  progress?: number;
  cachedAt: number;
  metadata?: any;
}

interface CachedVideo {
  id: string;
  contentId: string;
  contentType: 'movie' | 'episode';
  blob: Blob;
  size: number;
  expiresAt: number;
  cachedAt: number;
  rentalId?: string;
}

class IndexedDBCache {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: 'id' });
        }
        
        // Create video blob store
        if (!db.objectStoreNames.contains(VIDEO_STORE)) {
          const videoStore = db.createObjectStore(VIDEO_STORE, { keyPath: 'id' });
          videoStore.createIndex('contentId', 'contentId', { unique: false });
          videoStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });
  }

  async set(key: string, value: CachedContent): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.put({ ...value, id: key, cachedAt: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get(key: string): Promise<CachedContent | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(): Promise<CachedContent[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Video blob storage methods
  async cacheVideo(video: Omit<CachedVideo, 'id' | 'cachedAt'>): Promise<void> {
    if (!this.db) await this.init();
    
    // Check cache size
    const currentSize = await this.getCacheSize();
    if (currentSize + video.size > MAX_CACHE_SIZE) {
      await this.cleanupOldVideos();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([VIDEO_STORE], 'readwrite');
      const store = transaction.objectStore(VIDEO_STORE);
      const id = `${video.contentType}_${video.contentId}`;
      const request = store.put({ ...video, id, cachedAt: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedVideo(contentId: string, contentType: 'movie' | 'episode'): Promise<CachedVideo | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([VIDEO_STORE], 'readonly');
      const store = transaction.objectStore(VIDEO_STORE);
      const id = `${contentType}_${contentId}`;
      const request = store.get(id);

      request.onsuccess = () => {
        const video = request.result;
        // Check if video has expired
        if (video && video.expiresAt > Date.now()) {
          resolve(video);
        } else if (video) {
          // Remove expired video
          this.deleteCachedVideo(contentId, contentType);
          resolve(null);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteCachedVideo(contentId: string, contentType: 'movie' | 'episode'): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([VIDEO_STORE], 'readwrite');
      const store = transaction.objectStore(VIDEO_STORE);
      const id = `${contentType}_${contentId}`;
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCacheSize(): Promise<number> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([VIDEO_STORE], 'readonly');
      const store = transaction.objectStore(VIDEO_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const videos = request.result || [];
        const totalSize = videos.reduce((sum, video) => sum + (video.size || 0), 0);
        resolve(totalSize);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async cleanupOldVideos(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([VIDEO_STORE], 'readwrite');
      const store = transaction.objectStore(VIDEO_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const videos = request.result || [];
        // Sort by cached date, oldest first
        videos.sort((a, b) => a.cachedAt - b.cachedAt);
        
        // Delete oldest 30% of videos
        const deleteCount = Math.ceil(videos.length * 0.3);
        const deletePromises = videos.slice(0, deleteCount).map(video => 
          new Promise<void>((res, rej) => {
            const delReq = store.delete(video.id);
            delReq.onsuccess = () => res();
            delReq.onerror = () => rej(delReq.error);
          })
        );

        Promise.all(deletePromises).then(() => resolve()).catch(reject);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllCachedVideos(): Promise<CachedVideo[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([VIDEO_STORE], 'readonly');
      const store = transaction.objectStore(VIDEO_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const videos = request.result || [];
        // Filter out expired videos
        const validVideos = videos.filter(v => v.expiresAt > Date.now());
        resolve(validVideos);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const dbCache = new IndexedDBCache();
