/**
 * Background Sync Manager for offline operations
 * Queues failed requests and retries when connection is restored
 */

export interface SyncTask {
  id: string;
  type: 'rental' | 'favorite' | 'watch_progress' | 'wallet';
  data: any;
  timestamp: number;
  retries: number;
}

const SYNC_QUEUE_KEY = 'signature-tv-sync-queue';
const MAX_RETRIES = 3;

class BackgroundSyncManager {
  private queue: SyncTask[] = [];
  private isProcessing = false;

  constructor() {
    this.loadQueue();
    this.setupOnlineListener();
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem(SYNC_QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  private setupOnlineListener() {
    window.addEventListener('online', () => {
      console.log('Connection restored, processing sync queue...');
      this.processQueue();
    });
  }

  /**
   * Add a task to the sync queue
   */
  addTask(type: SyncTask['type'], data: any): string {
    const task: SyncTask = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(task);
    this.saveQueue();

    // Try to process immediately if online
    if (navigator.onLine) {
      this.processQueue();
    }

    return task.id;
  }

  /**
   * Process all queued tasks
   */
  async processQueue() {
    if (this.isProcessing || !navigator.onLine || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const tasksToProcess = [...this.queue];
      
      for (const task of tasksToProcess) {
        try {
          await this.processTask(task);
          // Remove successful task from queue
          this.queue = this.queue.filter(t => t.id !== task.id);
        } catch (error) {
          console.error(`Failed to process task ${task.id}:`, error);
          
          // Increment retry count
          const taskIndex = this.queue.findIndex(t => t.id === task.id);
          if (taskIndex !== -1) {
            this.queue[taskIndex].retries++;
            
            // Remove task if max retries exceeded
            if (this.queue[taskIndex].retries >= MAX_RETRIES) {
              console.warn(`Task ${task.id} exceeded max retries, removing from queue`);
              this.queue.splice(taskIndex, 1);
            }
          }
        }
      }

      this.saveQueue();
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single task
   */
  private async processTask(task: SyncTask): Promise<void> {
    console.log(`Processing sync task: ${task.type}`, task.data);

    // Import Supabase client dynamically to avoid circular dependencies
    const { supabase } = await import('@/integrations/supabase/client');

    switch (task.type) {
      case 'rental':
        await supabase.from('rentals').insert(task.data);
        break;
      
      case 'favorite':
        if (task.data.action === 'add') {
          await supabase.from('favorites').insert(task.data.favorite);
        } else if (task.data.action === 'remove') {
          await supabase.from('favorites').delete().eq('id', task.data.favoriteId);
        }
        break;
      
      case 'watch_progress':
        await supabase.from('watch_history').upsert(task.data);
        break;
      
      case 'wallet':
        // Handle wallet transactions
        await supabase.rpc('process_wallet_transaction', task.data);
        break;
      
      default:
        console.warn(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Get pending tasks count
   */
  getPendingCount(): number {
    return this.queue.length;
  }

  /**
   * Clear all tasks
   */
  clearQueue() {
    this.queue = [];
    this.saveQueue();
  }
}

// Export singleton instance
export const backgroundSync = new BackgroundSyncManager();
