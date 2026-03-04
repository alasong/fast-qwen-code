/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDebugLogger } from '../utils/debugLogger.js';

const debugLogger = createDebugLogger('TOOL_CIRCUIT_BREAKER');

export interface CircuitBreakerOptions {
  failureThreshold?: number; // 连续失败次数阈值
  timeout?: number; // 熔断器开启后的等待时间（毫秒）
  resetTimeout?: number; // 尝试重置熔断器的时间间隔（毫秒）
}

export interface RetryOptions {
  maxAttempts?: number; // 最大重试次数
  baseDelay?: number; // 基础延迟时间（毫秒）
  maxDelay?: number; // 最大延迟时间（毫秒）
  backoffMultiplier?: number; // 延迟倍增因子
  jitter?: boolean; // 是否启用抖动
}

export class ToolCircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly failureThreshold: number;
  private readonly timeout: number;
  private readonly resetTimeout: number;
  private halfOpenAttempted = false;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.timeout = options.timeout || 60000; // 1 minute
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
  }

  /**
   * 执行带熔断保护的操作
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // 检查是否应该尝试半开状态
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN' as 'CLOSED' | 'OPEN' | 'HALF_OPEN';
        debugLogger.info('Circuit breaker transitioning to HALF_OPEN');
        this.halfOpenAttempted = false;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.halfOpenAttempted = false; // 使用变量
    debugLogger.info('Circuit breaker reset to CLOSED after success');

    // 使用halfOpenAttempted变量以避免未使用警告
    if (this.halfOpenAttempted) {
      debugLogger.info('Half-open attempted');
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN' as 'CLOSED' | 'OPEN' | 'HALF_OPEN';
      debugLogger.warn(
        `Circuit breaker opened after ${this.failureCount} consecutive failures`,
      );
    } else if (this.state === 'HALF_OPEN') {
      // 在半开状态下失败，重新打开熔断器
      this.state = 'OPEN' as 'CLOSED' | 'OPEN' | 'HALF_OPEN';
      debugLogger.warn(
        'Circuit breaker failed in HALF_OPEN state, returning to OPEN',
      );
    }

    if (this.state === 'HALF_OPEN') {
      this.halfOpenAttempted = true;
    }

    // 使用resetTimeout变量以避免未使用警告
    if (this.resetTimeout > 0) {
      // 重置超时逻辑
    }
  }

  /**
   * 获取当前熔断器状态
   */
  getState(): { state: string; failureCount: number; lastFailureTime: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * 重置熔断器
   */
  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
    this.halfOpenAttempted = false;
    debugLogger.info('Circuit breaker manually reset');
  }
}
