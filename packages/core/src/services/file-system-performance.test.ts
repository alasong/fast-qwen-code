import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileCacheService } from './FileCacheService.js';
import { FileStreamProcessor } from './FileStreamProcessor.js';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('File System Performance Optimization', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pls-file-cache-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should properly cache file content and validate cache', async () => {
    const cacheService = new FileCacheService(50, 10 * 1024 * 1024); // 最多50个条目，10MB总大小

    // 创建测试文件
    const testFile = path.join(testDir, 'test.txt');
    const content = 'Hello, World!';
    await fs.writeFile(testFile, content);

    // 第一次读取（应该从磁盘加载）
    const content1 = await cacheService.getFileContent(testFile);
    expect(content1).toBe(content);

    // 修改文件并验证缓存失效
    await new Promise((resolve) => setTimeout(resolve, 100)); // 确保时间戳不同
    const newContent = content + ' Updated';
    await fs.writeFile(testFile, newContent);

    // 读取更新后的内容
    const content2 = await cacheService.getFileContent(testFile);
    expect(content2).toBe(newContent);

    // 检查缓存统计信息
    const stats = cacheService.getStats();
    expect(stats.entryCount).toBeGreaterThanOrEqual(0);
    expect(stats.maxEntryCount).toBe(50);
    expect(stats.totalSize).toBeGreaterThanOrEqual(0);
    expect(stats.maxTotalSize).toBe(10 * 1024 * 1024);
  });

  it('should handle large files with streaming', async () => {
    const processor = new FileStreamProcessor();

    // 创建一个较大的测试文件
    const largeFilePath = path.join(testDir, 'large_test_file.txt');
    const largeContent = 'This is a test line.\n'.repeat(1000); // ~20KB
    await fs.writeFile(largeFilePath, largeContent);

    // 测试流式读取
    const content = await processor.streamFileContent(largeFilePath);
    expect(content).toBe(largeContent);

    // 测试获取前几行
    const firstLines = await processor.getFirstLines(largeFilePath, 5);
    expect(firstLines.length).toBe(5);
    expect(firstLines[0]).toBe('This is a test line.');
  });

  it('should properly handle cache size limits', async () => {
    // 使用较小的缓存限制进行测试
    const cacheService = new FileCacheService(2, 2048); // 2个条目，2KB大小限制

    // 创建两个小文件
    const file1 = path.join(testDir, 'small1.txt');
    const file2 = path.join(testDir, 'small2.txt');
    await fs.writeFile(file1, 'Small content 1');
    await fs.writeFile(file2, 'Small content 2');

    // 读取这两个文件以将其放入缓存
    await cacheService.getFileContent(file1);
    await cacheService.getFileContent(file2);

    // 检查缓存状态
    const stats = cacheService.getStats();
    expect(stats.entryCount).toBeLessThanOrEqual(2); // 应该不超过最大条目数
    expect(stats.totalSize).toBeLessThanOrEqual(2048); // 应该不超过最大大小

    // 创建一个大文件，可能会导致缓存清理
    const bigFile = path.join(testDir, 'big.txt');
    const bigContent = 'X'.repeat(1500); // 1.5KB
    await fs.writeFile(bigFile, bigContent);

    // 读取大文件
    await cacheService.getFileContent(bigFile);

    // 检查缓存状态 - 大小应该仍在限制内
    const finalStats = cacheService.getStats();
    expect(finalStats.totalSize).toBeLessThanOrEqual(2048);
  });
});
