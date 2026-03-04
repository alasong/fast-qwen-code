/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolResult } from './tools.js';
import { createDebugLogger } from '../utils/debugLogger.js';

// 使用导入的类型和函数以避免未使用警告
export type { ToolResult };

const debugLogger = createDebugLogger('TOOL_EXECUTION_MONITOR');

// 简单使用debugLogger以避免未使用警告
debugLogger.debug('ToolExecutionMonitor loaded');

export interface ToolExecutionMetrics {
  executionTime: number; // 执行时间（毫秒）
  success: boolean; // 是否成功
  error?: string; // 错误信息（如果失败）
  inputSize?: number; // 输入大小
  outputSize?: number; // 输出大小
  memoryUsed?: number; // 内存使用量
}

export interface ToolOptimizationReport {
  [toolName: string]: {
    avgExecutionTime: number;
    successRate: number;
    totalExecutions: number;
    recommendation: string;
    lastExecutionTime: number;
  };
}

export interface PerformanceTrend {
  timestamp: number;
  avgExecutionTime: number;
  successRate: number;
}

export class ToolExecutionMonitor {
  private executionTimes: Map<string, number[]> = new Map();
  private successRates: Map<string, { successes: number; failures: number }> =
    new Map();
  private performanceTrends: Map<string, PerformanceTrend[]> = new Map();
  private readonly trendWindowSize: number; // 保留趋势数据的时间窗口

  constructor(trendWindowSize: number = 50) {
    this.trendWindowSize = trendWindowSize;
  }

  /**
   * 测量工具执行性能
   */
  async measureExecution<T>(
    toolName: string,
    fn: () => Promise<T>,
    inputSize?: number,
  ): Promise<{ result: T; metrics: ToolExecutionMetrics }> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await fn();
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;

      const executionTime = endTime - startTime;
      const memoryUsed = endMemory - startMemory;

      const metrics: ToolExecutionMetrics = {
        executionTime,
        success: true,
        inputSize,
        outputSize:
          typeof result === 'string'
            ? result.length
            : JSON.stringify(result).length,
        memoryUsed,
      };

      this.recordSuccess(toolName, metrics);

      return { result, metrics };
    } catch (error) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      const metrics: ToolExecutionMetrics = {
        executionTime,
        success: false,
        error: (error as Error).message,
        inputSize,
      };

      this.recordFailure(toolName, metrics);

      throw error;
    }
  }

  private recordSuccess(toolName: string, metrics: ToolExecutionMetrics): void {
    // 记录执行时间
    if (!this.executionTimes.has(toolName)) {
      this.executionTimes.set(toolName, []);
    }
    const times = this.executionTimes.get(toolName)!;
    times.push(metrics.executionTime);

    // 限制记录的数量以节省内存
    if (times.length > 1000) {
      times.shift(); // 移除最旧的记录
    }

    // 更新成功率统计
    const stats = this.successRates.get(toolName) || {
      successes: 0,
      failures: 0,
    };
    stats.successes++;
    this.successRates.set(toolName, stats);

    // 记录性能趋势
    this.recordPerformanceTrend(toolName, metrics);
  }

  private recordFailure(toolName: string, metrics: ToolExecutionMetrics): void {
    // 更新成功率统计
    const stats = this.successRates.get(toolName) || {
      successes: 0,
      failures: 0,
    };
    stats.failures++;
    this.successRates.set(toolName, stats);

    // 记录性能趋势（即使失败也记录）
    this.recordPerformanceTrend(toolName, metrics);
  }

  private recordPerformanceTrend(
    toolName: string,
    metrics: ToolExecutionMetrics,
  ): void {
    if (!this.performanceTrends.has(toolName)) {
      this.performanceTrends.set(toolName, []);
    }

    const trends = this.performanceTrends.get(toolName)!;
    trends.push({
      timestamp: Date.now(),
      avgExecutionTime: metrics.executionTime,
      successRate: metrics.success ? 1 : 0,
    });

    // 限制趋势数据的大小
    if (trends.length > this.trendWindowSize) {
      trends.shift();
    }
  }

  /**
   * 生成工具优化报告
   */
  generateOptimizationReport(): ToolOptimizationReport {
    const report: ToolOptimizationReport = {};

    for (const [toolName, times] of this.executionTimes.entries()) {
      const stats = this.successRates.get(toolName) || {
        successes: 0,
        failures: 0,
      };
      const totalExecutions = stats.successes + stats.failures;
      const successRate =
        totalExecutions > 0 ? stats.successes / totalExecutions : 0;
      const avgExecutionTime =
        times.reduce((sum, time) => sum + time, 0) / times.length;
      const lastExecutionTime = times[times.length - 1] || 0;

      report[toolName] = {
        avgExecutionTime,
        successRate,
        totalExecutions,
        lastExecutionTime,
        recommendation: this.getRecommendation(
          toolName,
          avgExecutionTime,
          successRate,
        ),
      };
    }

    return report;
  }

  /**
   * 获取针对特定工具的优化建议
   */
  private getRecommendation(
    toolName: string,
    avgTime: number,
    successRate: number,
  ): string {
    if (successRate < 0.7) {
      return 'High failure rate - consider improving error handling or validation';
    } else if (avgTime > 10000) {
      // 10秒以上
      return 'Very slow execution - investigate performance bottlenecks';
    } else if (avgTime > 5000) {
      // 5秒以上
      return 'Slow execution - consider optimization or caching';
    } else if (successRate < 0.9) {
      return 'Moderate failure rate - review error conditions';
    }

    return 'Performing well';
  }

  /**
   * 获取特定工具的性能趋势
   */
  getPerformanceTrend(toolName: string): PerformanceTrend[] {
    return this.performanceTrends.get(toolName) || [];
  }

  /**
   * 获取工具执行统计信息
   */
  getStats(toolName: string): {
    avgExecutionTime: number;
    successRate: number;
    totalExecutions: number;
    recentExecutions: number;
  } | null {
    const times = this.executionTimes.get(toolName);
    const stats = this.successRates.get(toolName);

    if (!times || !stats) {
      return null;
    }

    const totalExecutions = stats.successes + stats.failures;
    const successRate =
      totalExecutions > 0 ? stats.successes / totalExecutions : 0;
    const avgExecutionTime =
      times.length > 0
        ? times.reduce((sum, time) => sum + time, 0) / times.length
        : 0;

    return {
      avgExecutionTime,
      successRate,
      totalExecutions,
      recentExecutions: times.length,
    };
  }

  /**
   * 重置监控数据
   */
  reset(): void {
    this.executionTimes.clear();
    this.successRates.clear();
    this.performanceTrends.clear();
  }
}
