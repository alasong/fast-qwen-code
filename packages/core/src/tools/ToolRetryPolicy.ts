/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDebugLogger } from '../utils/debugLogger.js';

const debugLogger = createDebugLogger('TOOL_RETRY_POLICY');

export interface RetryOptions {
  maxAttempts?: number; // 最大重试次数
  baseDelay?: number; // 基础延迟时间（毫秒）
  maxDelay?: number; // 最大延迟时间（毫秒）
  backoffMultiplier?: number; // 延迟倍增因子
  jitter?: boolean; // 是否启用抖动
  retryableErrors?: (error: Error) => boolean; // 判断错误是否可重试
}

export class ToolRetryPolicy {
  private readonly maxAttempts: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private readonly backoffMultiplier: number;
  private readonly jitter: boolean;
  private readonly retryableErrors: (error: Error) => boolean;

  constructor(options: RetryOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseDelay = options.baseDelay ?? 1000; // 1秒
    this.maxDelay = options.maxDelay ?? 30000; // 30秒
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
    this.jitter = options.jitter ?? true;
    this.retryableErrors = options.retryableErrors ?? (() => true); // 默认所有错误都可重试
  }

  /**
   * 执行带重试机制的操作
   */
  async execute<T>(
    fn: () => Promise<T>,
    options: Partial<RetryOptions> = {},
  ): Promise<T> {
    const maxAttempts = options.maxAttempts ?? this.maxAttempts;
    const retryableErrors = options.retryableErrors ?? this.retryableErrors;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // 检查错误是否可重试
        if (!retryableErrors(lastError)) {
          debugLogger.error(
            `Non-retryable error occurred: ${lastError.message}`,
          );
          throw lastError;
        }

        if (attempt === maxAttempts - 1) {
          // 最后一次尝试失败，抛出错误
          break;
        }

        const delay = this.calculateDelay(attempt);
        debugLogger.warn(
          `Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${lastError.message}`,
        );

        await this.delay(delay);
      }
    }

    // 所有重试都失败了
    throw lastError!;
  }

  /**
   * 计算重试延迟时间
   */
  private calculateDelay(attempt: number): number {
    let delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt);
    delay = Math.min(delay, this.maxDelay);

    // 添加抖动以避免雷群效应
    if (this.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.round(delay);
  }

  /**
   * 延迟指定时间
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
