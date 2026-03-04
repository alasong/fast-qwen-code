import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import type { Stats } from 'fs';
import { LruCache } from '../utils/LruCache.js';

interface CachedFileInfo {
  stats: Stats;
  content?: string;
  contentHash?: string; // 内容哈希
  timestamp: number;
  size: number; // 文件内容大小（字节）
}

export class FileCacheService {
  private cache: LruCache<string, CachedFileInfo>;
  private maxEntryCount: number; // 最大条目数
  private maxTotalSize: number; // 最大大小（字节）
  private currentTotalSize: number = 0; // 当前总大小（字节）

  constructor(
    maxEntryCount: number = 100,
    maxTotalSize: number = 50 * 1024 * 1024,
  ) {
    // 默认50MB
    this.maxEntryCount = maxEntryCount;
    this.maxTotalSize = maxTotalSize;
    this.cache = new LruCache<string, CachedFileInfo>(maxEntryCount);
  }

  /**
   * 检查缓存是否有效
   */
  async isValidCache(
    cache: CachedFileInfo,
    filePath: string,
  ): Promise<boolean> {
    try {
      const currentStats = await fs.stat(filePath);

      // 时间戳检查
      if (currentStats.mtimeMs > cache.timestamp) {
        // 时间戳变化，检查内容哈希
        if (cache.contentHash) {
          const currentContent = await fs.readFile(filePath, 'utf-8');
          const currentHash = createHash('sha256')
            .update(currentContent)
            .digest('hex');

          // 如果内容哈希相同，则缓存仍然有效
          if (currentHash === cache.contentHash) {
            // 更新缓存的时间戳以避免重复检查
            cache.timestamp = Date.now();
            return true;
          }
        }
        return false;
      }

      return true;
    } catch (_error) {
      // 文件可能已被删除
      return false;
    }
  }

  /**
   * 获取文件内容，优先从缓存获取
   */
  async getFileContent(filePath: string): Promise<string | null> {
    const cached = this.cache.get(filePath);

    if (cached) {
      const isValid = await this.isValidCache(cached, filePath);

      if (isValid) {
        // 将缓存项移到最近使用位置
        this.cache.set(filePath, cached);
        return cached.content || null;
      } else {
        // 缓存失效，删除它并更新大小
        this.removeCachedItem(filePath, cached);
      }
    }

    // 从磁盘读取文件
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      const contentHash = createHash('sha256').update(content).digest('hex');
      const contentSize = Buffer.byteLength(content, 'utf-8');

      // 检查是否超出大小限制
      if (this.wouldExceedSizeLimits(contentSize)) {
        // 如果超出限制，尝试清理一些空间
        this.makeSpaceForNewEntry(contentSize);
      }

      // 存储到缓存
      const cacheEntry: CachedFileInfo = {
        stats,
        content,
        contentHash,
        timestamp: Date.now(),
        size: contentSize,
      };
      this.cache.set(filePath, cacheEntry);
      this.currentTotalSize += contentSize;

      return content;
    } catch (_error) {
      // Failed to read file
      return null;
    }
  }

  /**
   * 获取文件统计信息
   */
  async getFileStats(filePath: string): Promise<Stats | null> {
    const cached = this.cache.get(filePath);

    if (cached) {
      const isValid = await this.isValidCache(cached, filePath);

      if (isValid) {
        // 将缓存项移到最近使用位置
        this.cache.set(filePath, cached);
        return cached.stats;
      } else {
        // 缓存失效，删除它
        this.removeFromCache(filePath);
      }
    }

    try {
      const stats = await fs.stat(filePath);
      // 如果我们已经有了文件内容，我们可以更新缓存而不必重新读取内容
      const content = cached?.content;
      if (content && cached?.contentHash) {
        const contentSize = cached.size;
        this.cache.set(filePath, {
          stats,
          content,
          contentHash: cached.contentHash,
          timestamp: Date.now(),
          size: contentSize,
        });
      }
      return stats;
    } catch (_error) {
      // Failed to stat file
      return null;
    }
  }

  /**
   * 清除特定文件的缓存
   */
  removeFromCache(filePath: string): void {
    const cached = this.cache.get(filePath);
    if (cached) {
      this.removeCachedItem(filePath, cached);
    }
  }

  /**
   * 删除缓存项并更新大小统计
   */
  private removeCachedItem(filePath: string, cached: CachedFileInfo): void {
    this.cache.delete(filePath);
    this.currentTotalSize -= cached.size;
  }

  /**
   * 检查添加新条目是否会超出大小限制
   */
  private wouldExceedSizeLimits(newContentSize: number): boolean {
    return (
      this.cache.size() >= this.maxEntryCount ||
      this.currentTotalSize + newContentSize > this.maxTotalSize
    );
  }

  /**
   * 为新条目腾出空间
   */
  private makeSpaceForNewEntry(requiredSize: number): void {
    // 首先尝试移除LRU项直到有足够的条目空间
    while (this.cache.size() >= this.maxEntryCount && this.cache.size() > 0) {
      // 由于LRU缓存的内部实现，我们不能直接获取最老的项
      // 所以我们简单地删除一项
      // 在实际的LRU实现中，当添加新项时会自动删除最老的项
      break;
    }

    // 然后尝试移除足够大的空间以满足大小要求
    while (
      this.currentTotalSize + requiredSize > this.maxTotalSize &&
      this.cache.size() > 0
    ) {
      // 获取一个键（由于LRU的性质，这应该是最近最少使用的）
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const cached = this.cache.get(oldestKey);
        if (cached) {
          this.removeCachedItem(oldestKey, cached);
        }
      } else {
        break; // 没有更多项可以删除
      }
    }
  }

  /**
   * 清空整个缓存
   */
  clear(): void {
    this.cache.clear();
    this.currentTotalSize = 0;
  }

  // evictIfNecessary 方法已移除，因为未被使用

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    entryCount: number;
    maxEntryCount: number;
    totalSize: number;
    maxTotalSize: number;
  } {
    return {
      entryCount: this.cache.size(),
      maxEntryCount: this.maxEntryCount,
      totalSize: this.currentTotalSize,
      maxTotalSize: this.maxTotalSize,
    };
  }
}
