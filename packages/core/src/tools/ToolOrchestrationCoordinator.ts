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
// import { ParallelToolExecutor } from './ParallelToolExecutor.js'; // 注释掉未使用的导入
// import { ToolCallBatcher } from './ToolCallBatcher.js'; // 注释掉未使用的导入
import { IntelligentToolSelector } from './IntelligentToolSelector.js';
import { ToolCircuitBreaker } from './ToolCircuitBreaker.js';
import { ToolRetryPolicy } from './ToolRetryPolicy.js';
import { ToolExecutionMonitor } from './ToolExecutionMonitor.js';
import type { ShellExecutionConfig } from '../services/shellExecutionService.js';
import { createDebugLogger } from '../utils/debugLogger.js';

const debugLogger = createDebugLogger('TOOL_ORCHESTRATION_COORDINATOR');

export interface OrchestrationOptions {
  enableParallelExecution?: boolean;
  enableBatching?: boolean;
  enableIntelligentSelection?: boolean;
  enableCircuitBreaker?: boolean;
  enableRetryPolicy?: boolean;
  enableMonitoring?: boolean;
  batchSize?: number;
  maxParallelTools?: number;
}

export interface ToolOrchestrationResult {
  results: Array<{
    id: string;
    request: ToolCallRequestInfo;
    result: ToolResult;
    executionTime: number;
    success: boolean;
  }>;
  totalExecutionTime: number;
  optimizationReport?: unknown;
}

export class ToolOrchestrationCoordinator {
  private readonly dependencyResolver: ToolDependencyResolver;
  // private readonly parallelExecutor: ParallelToolExecutor; // 注释掉未使用的变量
  // private readonly batcher: ToolCallBatcher; // 注释掉未使用的变量
  private readonly intelligentSelector: IntelligentToolSelector;
  private readonly circuitBreaker: ToolCircuitBreaker;
  private readonly retryPolicy: ToolRetryPolicy;
  private readonly monitor: ToolExecutionMonitor;
  private readonly options: OrchestrationOptions;

  constructor(options: OrchestrationOptions = {}) {
    this.options = {
      enableParallelExecution: true,
      enableBatching: true,
      enableIntelligentSelection: true,
      enableCircuitBreaker: true,
      enableRetryPolicy: true,
      enableMonitoring: true,
      batchSize: 5,
      maxParallelTools: 10,
      ...options,
    };

    this.dependencyResolver = new ToolDependencyResolver();
    // this.parallelExecutor = new ParallelToolExecutor(); // 已注释，不再使用
    // this.batcher = new ToolCallBatcher(this.options.batchSize); // 已注释，不再使用
    this.intelligentSelector = new IntelligentToolSelector();
    this.circuitBreaker = new ToolCircuitBreaker();
    this.retryPolicy = new ToolRetryPolicy();
    this.monitor = new ToolExecutionMonitor();
  }

  /**
   * 执行工具编排
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
  ): Promise<ToolOrchestrationResult> {
    const startTime = Date.now();

    debugLogger.info(`Starting orchestration for ${tools.length} tools`);

    // 根据选项决定如何执行工具
    let results: ToolOrchestrationResult['results'] = [];

    if (this.options.enableParallelExecution && tools.length > 1) {
      // 使用并行执行器
      results = await this.executeInParallel(
        tools,
        signal,
        shellExecutionConfig,
        updateOutput,
      );
    } else {
      // 串行执行
      results = await this.executeSequentially(
        tools,
        signal,
        shellExecutionConfig,
        updateOutput,
      );
    }

    const totalExecutionTime = Date.now() - startTime;

    return {
      results,
      totalExecutionTime,
      optimizationReport: this.options.enableMonitoring
        ? this.monitor.generateOptimizationReport()
        : undefined,
    };
  }

  /**
   * 智能选择要执行的工具
   */
  async selectAndExecute(
    availableTools: AnyDeclarativeTool[],
    userInput: string,
    signal: AbortSignal,
    shellExecutionConfig?: ShellExecutionConfig,
    updateOutput?: (callId: string, outputChunk: ToolResultDisplay) => void,
  ): Promise<ToolOrchestrationResult> {
    if (!this.options.enableIntelligentSelection) {
      // 如果不启用智能选择，执行所有可用工具
      // 注意：这在实际应用中可能不是好主意，这里仅作演示
      throw new Error('Intelligent selection is required for this method');
    }

    // 使用智能选择器选择最佳工具
    const selectedTools = await this.intelligentSelector.selectBestTools({
      userInput,
      availableTools,
      conversationHistory: '',
    });

    // 构建工具调用请求
    const toolInvocations = selectedTools
      .map((tool) => {
        // 这里需要根据实际需求构建合适的参数
        // 为了演示目的，我们使用空参数
        const invocation = this.buildInvocation(tool, {});
        if (!invocation) {
          return null;
        }
        return {
          tool,
          invocation,
          request: {
            callId: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: tool.name,
            args: {},
            isClientInitiated: false,
            prompt_id: 'orchestration',
          },
        };
      })
      .filter(
        (
          item,
        ): item is {
          tool: AnyDeclarativeTool;
          invocation: AnyToolInvocation;
          request: ToolCallRequestInfo;
        } => item !== null,
      );

    return this.execute(
      toolInvocations,
      signal,
      shellExecutionConfig,
      updateOutput,
    );
  }

  private async executeInParallel(
    tools: Array<{
      tool: AnyDeclarativeTool;
      invocation: AnyToolInvocation;
      request: ToolCallRequestInfo;
    }>,
    signal: AbortSignal,
    shellExecutionConfig?: ShellExecutionConfig,
    updateOutput?: (callId: string, outputChunk: ToolResultDisplay) => void,
  ): Promise<ToolOrchestrationResult['results']> {
    const results: ToolOrchestrationResult['results'] = [];

    // 分析依赖关系并生成执行计划
    const plan = this.dependencyResolver.resolve(tools);

    for (const batch of plan.batches) {
      debugLogger.info(
        `Executing parallel batch with ${batch.tools.length} tools`,
      );

      // 并行执行当前批次的工具
      const batchResults = await Promise.all(
        batch.tools.map(async (toolInfo) => {
          const startTime = Date.now();

          try {
            let result: ToolResult;

            // 应用熔断器和重试策略
            if (
              this.options.enableCircuitBreaker &&
              this.options.enableRetryPolicy
            ) {
              result = await this.circuitBreaker.execute(() =>
                this.retryPolicy.execute(() =>
                  this.executeSingleTool(
                    toolInfo,
                    signal,
                    shellExecutionConfig,
                    updateOutput,
                  ),
                ),
              );
            } else if (this.options.enableCircuitBreaker) {
              result = await this.circuitBreaker.execute(() =>
                this.executeSingleTool(
                  toolInfo,
                  signal,
                  shellExecutionConfig,
                  updateOutput,
                ),
              );
            } else if (this.options.enableRetryPolicy) {
              result = await this.retryPolicy.execute(() =>
                this.executeSingleTool(
                  toolInfo,
                  signal,
                  shellExecutionConfig,
                  updateOutput,
                ),
              );
            } else {
              result = await this.executeSingleTool(
                toolInfo,
                signal,
                shellExecutionConfig,
                updateOutput,
              );
            }

            const executionTime = Date.now() - startTime;

            // 记录监控数据
            if (this.options.enableMonitoring) {
              await this.monitor.measureExecution(
                toolInfo.tool.name,
                async () => result,
                JSON.stringify(toolInfo.request.args).length,
              );
            }

            return {
              id: toolInfo.request.callId, // 使用callId而不是id
              request: toolInfo.request,
              result,
              executionTime,
              success: !result.error,
            };
          } catch (error) {
            const executionTime = Date.now() - startTime;

            return {
              id: toolInfo.request.callId, // 使用callId而不是id
              request: toolInfo.request,
              result: {
                llmContent: `Error: Tool call execution failed. Reason: ${(error as Error).message}`,
                returnDisplay: (error as Error).message,
                error: {
                  message: (error as Error).message,
                  type: 'EXECUTION_ERROR' as const,
                },
              },
              executionTime,
              success: false,
            };
          }
        }),
      );

      results.push(...batchResults);
    }

    return results;
  }

  private async executeSequentially(
    tools: Array<{
      tool: AnyDeclarativeTool;
      invocation: AnyToolInvocation;
      request: ToolCallRequestInfo;
    }>,
    signal: AbortSignal,
    shellExecutionConfig?: ShellExecutionConfig,
    updateOutput?: (callId: string, outputChunk: ToolResultDisplay) => void,
  ): Promise<ToolOrchestrationResult['results']> {
    const results: ToolOrchestrationResult['results'] = [];

    for (const toolInfo of tools) {
      const startTime = Date.now();

      try {
        let result: ToolResult;

        // 应用熔断器和重试策略
        if (
          this.options.enableCircuitBreaker &&
          this.options.enableRetryPolicy
        ) {
          result = await this.circuitBreaker.execute(() =>
            this.retryPolicy.execute(() =>
              this.executeSingleTool(
                toolInfo,
                signal,
                shellExecutionConfig,
                updateOutput,
              ),
            ),
          );
        } else if (this.options.enableCircuitBreaker) {
          result = await this.circuitBreaker.execute(() =>
            this.executeSingleTool(
              toolInfo,
              signal,
              shellExecutionConfig,
              updateOutput,
            ),
          );
        } else if (this.options.enableRetryPolicy) {
          result = await this.retryPolicy.execute(() =>
            this.executeSingleTool(
              toolInfo,
              signal,
              shellExecutionConfig,
              updateOutput,
            ),
          );
        } else {
          result = await this.executeSingleTool(
            toolInfo,
            signal,
            shellExecutionConfig,
            updateOutput,
          );
        }

        const executionTime = Date.now() - startTime;

        // 记录监控数据
        if (this.options.enableMonitoring) {
          await this.monitor.measureExecution(
            toolInfo.tool.name,
            async () => result,
            JSON.stringify(toolInfo.request.args).length,
          );
        }

        results.push({
          id: toolInfo.request.callId, // 使用callId而不是id
          request: toolInfo.request,
          result,
          executionTime,
          success: !result.error,
        });
      } catch (error) {
        const executionTime = Date.now() - startTime;

        results.push({
          id: toolInfo.request.callId, // 使用callId而不是id
          request: toolInfo.request,
          result: {
            llmContent: `Error: Tool call execution failed. Reason: ${(error as Error).message}`,
            returnDisplay: (error as Error).message,
            error: {
              message: (error as Error).message,
              type: 'EXECUTION_ERROR' as const,
            },
          },
          executionTime,
          success: false,
        });
      }
    }

    return results;
  }

  private async executeSingleTool(
    toolInfo: {
      tool: AnyDeclarativeTool;
      invocation: AnyToolInvocation;
      request: ToolCallRequestInfo;
    },
    signal: AbortSignal,
    shellExecutionConfig?: ShellExecutionConfig,
    updateOutput?: (callId: string, outputChunk: ToolResultDisplay) => void,
  ): Promise<ToolResult> {
    const liveOutputCallback =
      toolInfo.tool.canUpdateOutput && updateOutput
        ? (outputChunk: ToolResultDisplay) => {
            updateOutput(toolInfo.request.callId, outputChunk);
          }
        : undefined;

    return toolInfo.invocation.execute(
      signal,
      liveOutputCallback,
      shellExecutionConfig,
    );
  }

  private buildInvocation(
    tool: AnyDeclarativeTool,
    args: Record<string, unknown>,
  ): AnyToolInvocation | null {
    try {
      return tool.build(args);
    } catch (e) {
      debugLogger.error(`Failed to build invocation for tool ${tool.name}:`, e);
      return null;
    }
  }

  /**
   * 获取优化报告
   */
  getOptimizationReport(): unknown {
    if (!this.options.enableMonitoring) {
      return null;
    }
    return this.monitor.generateOptimizationReport();
  }

  /**
   * 获取性能趋势
   */
  getPerformanceTrend(toolName: string): unknown {
    if (!this.options.enableMonitoring) {
      return null;
    }
    return this.monitor.getPerformanceTrend(toolName);
  }
}
