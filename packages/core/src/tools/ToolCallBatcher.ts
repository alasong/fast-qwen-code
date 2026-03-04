/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AnyDeclarativeTool,
  AnyToolInvocation,
  ToolResult,
} from './tools.js';
import type { ToolCallRequestInfo } from '../core/turn.js';
// import type { ShellExecutionConfig } from '../services/shellExecutionService.js'; // 注释掉未使用的导入
import { ParallelToolExecutor } from './ParallelToolExecutor.js';
import { createDebugLogger } from '../utils/debugLogger.js';

const debugLogger = createDebugLogger('TOOL_CALL_BATCHER');

export interface BatchedToolCall {
  callId: string;
  tool: AnyDeclarativeTool;
  invocation: AnyToolInvocation;
  request: ToolCallRequestInfo;
  resolve: (result: ToolResult) => void;
  reject: (error: Error) => void;
}

export class ToolCallBatcher {
  private batch: BatchedToolCall[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly batchSize: number;
  private readonly batchTimeout: number;
  private readonly parallelExecutor: ParallelToolExecutor;

  constructor(batchSize: number = 5, batchTimeout: number = 100) {
    this.batchSize = batchSize;
    this.batchTimeout = batchTimeout;
    this.parallelExecutor = new ParallelToolExecutor();
  }

  /**
   * 添加工具调用到批处理队列
   */
  add(
    tool: AnyDeclarativeTool,
    invocation: AnyToolInvocation,
    request: ToolCallRequestInfo,
  ): Promise<ToolResult> {
    return new Promise<ToolResult>((resolve, reject) => {
      this.batch.push({
        callId: request.callId,
        tool,
        invocation,
        request,
        resolve,
        reject,
      });

      if (this.batch.length >= this.batchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.batchTimeout);
      }
    });
  }

  /**
   * 立即执行所有待处理的工具调用
   */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.batch.length === 0) {
      return;
    }

    debugLogger.info(`Processing batch of ${this.batch.length} tool calls`);

    const currentBatch = [...this.batch];
    this.batch = [];

    try {
      // 将批处理中的工具转换为适合并行执行的格式
      const toolsForExecution = currentBatch.map((item) => ({
        tool: item.tool,
        invocation: item.invocation,
        request: item.request,
      }));

      // 使用并行执行器执行整个批次
      const result = await this.parallelExecutor.execute(
        toolsForExecution,
        new AbortController().signal,
      );

      // 将结果分配给相应的Promise
      for (let i = 0; i < currentBatch.length; i++) {
        const batchItem = currentBatch[i];
        const resultItem = result.results.find(
          (r) => r.id === batchItem.callId,
        );

        if (resultItem) {
          if (resultItem.error) {
            batchItem.reject(resultItem.error);
          } else {
            batchItem.resolve(resultItem.result);
          }
        } else {
          // 如果找不到结果，返回一个错误
          batchItem.reject(
            new Error(`No result found for tool call ${batchItem.callId}`),
          );
        }
      }
    } catch (error) {
      debugLogger.error('Error processing tool call batch:', error);

      // 如果整个批次失败，拒绝所有Promise
      for (const batchItem of currentBatch) {
        batchItem.reject(error as Error);
      }
    }
  }

  /**
   * 清空并取消所有待处理的工具调用
   */
  cancelAll(errorMsg: string = 'Tool call batch cancelled'): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    for (const batchItem of this.batch) {
      batchItem.reject(new Error(errorMsg));
    }

    this.batch = [];
  }

  /**
   * 获取当前批次中的工具调用数量
   */
  getBatchSize(): number {
    return this.batch.length;
  }
}
