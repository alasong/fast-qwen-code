/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AnyDeclarativeTool,
  AnyToolInvocation,
  ToolResult,
  ToolResultDisplay,
} from './tools.js';
import type { ToolCallRequestInfo } from '../core/turn.js';
import { ToolDependencyResolver } from './ToolDependencyResolver.js';
// import type { ToolExecutionPlan } from './ToolDependencyResolver.js'; // 注释掉未使用的类型
import type { ShellExecutionConfig } from '../services/shellExecutionService.js';
import { createDebugLogger } from '../utils/debugLogger.js';

const debugLogger = createDebugLogger('PARALLEL_TOOL_EXECUTOR');

export interface ParallelExecutionResult {
  results: Array<{
    id: string;
    request: ToolCallRequestInfo;
    result: ToolResult;
    error?: Error;
  }>;
  executionTime: number;
}

export class ParallelToolExecutor {
  private readonly dependencyResolver: ToolDependencyResolver;

  constructor() {
    this.dependencyResolver = new ToolDependencyResolver();
  }

  /**
   * 并行执行工具调用
   */
  async execute(
    tools: Array<{
      tool: AnyDeclarativeTool;
      invocation: AnyToolInvocation;
      request: ToolCallRequestInfo;
    }>,
    signal: AbortSignal,
    shellExecutionConfig?: ShellExecutionConfig,
    updateOutput?: (callId: string, outputChunk: ToolResultDisplay) => void,
  ): Promise<ParallelExecutionResult> {
    const startTime = Date.now();

    // 分析依赖关系并生成执行计划
    const plan = this.dependencyResolver.resolve(tools);

    const results: ParallelExecutionResult['results'] = [];

    // 按批次顺序执行
    for (const batch of plan.batches) {
      debugLogger.info(`Executing batch with ${batch.tools.length} tools`);

      // 并行执行当前批次的所有工具
      const batchResults = await Promise.all(
        batch.tools.map(async (toolInfo) => {
          try {
            const result = await this.executeSingleTool(
              toolInfo.tool,
              toolInfo.invocation,
              toolInfo.request,
              signal,
              shellExecutionConfig,
              updateOutput,
            );

            return {
              id: toolInfo.request.callId,
              request: toolInfo.request,
              result,
            };
          } catch (error) {
            debugLogger.error(
              `Error executing tool ${toolInfo.request.name}:`,
              error,
            );

            return {
              id: toolInfo.request.callId,
              request: toolInfo.request,
              result: {
                llmContent: `Error: Tool call execution failed. Reason: ${(error as Error).message}`,
                returnDisplay: (error as Error).message,
                error: {
                  message: (error as Error).message,
                  type: undefined, // 不设置具体类型，让其保持undefined
                },
              },
            };
          }
        }),
      );

      results.push(...batchResults);
    }

    const executionTime = Date.now() - startTime;

    return {
      results,
      executionTime,
    };
  }

  private async executeSingleTool(
    tool: AnyDeclarativeTool,
    invocation: AnyToolInvocation,
    request: ToolCallRequestInfo,
    signal: AbortSignal,
    shellExecutionConfig?: ShellExecutionConfig,
    updateOutput?: (callId: string, outputChunk: ToolResultDisplay) => void,
  ): Promise<ToolResult> {
    const liveOutputCallback =
      tool.canUpdateOutput && updateOutput
        ? (outputChunk: ToolResultDisplay) => {
            updateOutput(request.callId, outputChunk);
          }
        : undefined;

    return invocation.execute(signal, liveOutputCallback, shellExecutionConfig);
  }
}
