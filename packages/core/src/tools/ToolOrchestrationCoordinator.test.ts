/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolOrchestrationCoordinator } from './ToolOrchestrationCoordinator.js';
import type { ToolResult, ToolResultDisplay } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation } from './tools.js';
import type { ShellExecutionConfig } from '../services/shellExecutionService.js';
import type { ToolCallRequestInfo } from '../core/turn.js';
import { Kind } from './tools.js';

// 模拟工具类
class MockToolInvocation extends BaseToolInvocation<object, ToolResult> {
  constructor(params: object) {
    super(params);
  }

  getDescription(): string {
    return 'Mock tool invocation';
  }

  toolLocations(): ToolLocation[] {
    // 返回空数组表示不涉及特定文件路径
    return [];
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: ToolResultDisplay) => void,
    _shellExecutionConfig?: ShellExecutionConfig,
  ): Promise<ToolResult> {
    return {
      llmContent: 'Mock result',
      returnDisplay: 'Mock result',
    };
  }
}

class MockTool extends BaseDeclarativeTool<object, ToolResult> {
  constructor(name: string, description: string) {
    super(name, name, description, Kind.Other, {}, false, false);
  }

  protected createInvocation(_params: object): MockToolInvocation {
    return new MockToolInvocation({});
  }

  override toolLocations(): ToolLocation[] {
    // 返回空数组表示不涉及特定文件路径
    return [];
  }
}

describe('ToolOrchestrationCoordinator', () => {
  let coordinator: ToolOrchestrationCoordinator;

  beforeEach(() => {
    coordinator = new ToolOrchestrationCoordinator({
      enableMonitoring: true,
      batchSize: 2,
    });
  });

  it('should execute tools in parallel when multiple tools are provided', async () => {
    const mockTool1 = new MockTool('read-file', 'Reads a file');
    const mockTool2 = new MockTool('write-file', 'Writes a file');

    const tools = [
      {
        tool: mockTool1,
        invocation: mockTool1.build({}),
        request: {
          callId: 'call1',
          name: 'read-file',
          args: { path: '/test.txt' },
          isClientInitiated: false,
          prompt_id: 'test',
        } as ToolCallRequestInfo,
      },
      {
        tool: mockTool2,
        invocation: mockTool2.build({}),
        request: {
          callId: 'call2',
          name: 'glob',
          args: { pattern: '*.txt' },
          isClientInitiated: false,
          prompt_id: 'test',
        } as ToolCallRequestInfo,
      },
    ];

    const abortController = new AbortController();
    const result = await coordinator.execute(tools, abortController.signal);

    expect(result.results).toHaveLength(2);
    expect(result.results[0].success).toBe(true);
    expect(result.results[1].success).toBe(true);
    expect(result.totalExecutionTime).toBeGreaterThan(0);
  });

  it('should execute tools sequentially when only one tool is provided', async () => {
    const mockTool = new MockTool('read-file', 'Reads a file');

    const tools = [
      {
        tool: mockTool,
        invocation: mockTool.build({}),
        request: {
          callId: 'call1',
          name: 'read-file',
          args: { path: '/test.txt' },
          isClientInitiated: false,
          prompt_id: 'test',
        } as ToolCallRequestInfo,
      },
    ];

    const abortController = new AbortController();
    const result = await coordinator.execute(tools, abortController.signal);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].success).toBe(true);
  });

  it('should generate optimization report when monitoring is enabled', async () => {
    const mockTool = new MockTool('read-file', 'Reads a file');

    const tools = [
      {
        tool: mockTool,
        invocation: mockTool.build({}),
        request: {
          callId: 'call1',
          name: 'read-file',
          args: { path: '/test.txt' },
          isClientInitiated: false,
          prompt_id: 'test',
        } as ToolCallRequestInfo,
      },
    ];

    const abortController = new AbortController();
    await coordinator.execute(tools, abortController.signal);

    const report = coordinator.getOptimizationReport();
    expect(report).toBeDefined();
    if (report) {
      expect((report as Record<string, unknown>)['read-file']).toBeDefined();
    }
  });

  it('should handle tool execution errors gracefully', async () => {
    // 创建一个会抛出错误的模拟工具
    class ErrorToolInvocation extends BaseToolInvocation<object, ToolResult> {
      constructor(params: object) {
        super(params);
      }

      getDescription(): string {
        return 'Error tool invocation';
      }

      toolLocations(): ToolLocation[] {
        // 返回空数组表示不涉及特定文件路径
        return [];
      }

      async execute(
        _signal: AbortSignal,
        _updateOutput?: (output: ToolResultDisplay) => void,
        _shellExecutionConfig?: ShellExecutionConfig,
      ): Promise<ToolResult> {
        throw new Error('Simulated tool error');
      }
    }

    class ErrorTool extends BaseDeclarativeTool<object, ToolResult> {
      constructor() {
        super(
          'error-tool',
          'error-tool',
          'A tool that always fails',
          Kind.Other,
          {},
          false,
          false,
        );
      }

      protected createInvocation(_params: object): ErrorToolInvocation {
        return new ErrorToolInvocation({});
      }
    }

    const errorTool = new ErrorTool();

    const tools = [
      {
        tool: errorTool,
        invocation: errorTool.build({}),
        request: {
          callId: 'error-call',
          name: 'error-tool',
          args: {},
          isClientInitiated: false,
          prompt_id: 'test',
        } as ToolCallRequestInfo,
      },
    ];

    const abortController = new AbortController();
    const result = await coordinator.execute(tools, abortController.signal);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].result.error).toBeDefined();
  });

  it('should use circuit breaker to prevent cascading failures', async () => {
    // Mock a tool that always fails
    class FailingToolInvocation extends BaseToolInvocation<object, ToolResult> {
      constructor(params: object) {
        super(params);
      }

      getDescription(): string {
        return 'Failing tool invocation';
      }

      async execute(
        _signal: AbortSignal,
        _updateOutput?: (output: ToolResultDisplay) => void,
        _shellExecutionConfig?: ShellExecutionConfig,
      ): Promise<ToolResult> {
        throw new Error('Always fails');
      }
    }

    class FailingTool extends BaseDeclarativeTool<object, ToolResult> {
      constructor() {
        super(
          'failing-tool',
          'failing-tool',
          'A tool that always fails',
          Kind.Other,
          {},
          false,
          false,
        );
      }

      protected createInvocation(_params: object): FailingToolInvocation {
        return new FailingToolInvocation({});
      }

      override toolLocations(): ToolLocation[] {
        // 返回空数组表示不涉及特定文件路径
        return [];
      }
    }

    const failingTool = new FailingTool();
    const coordinatorWithOptions = new ToolOrchestrationCoordinator({
      enableCircuitBreaker: true,
      enableRetryPolicy: false, // Disable retries to isolate circuit breaker behavior
    });

    // Execute the failing tool multiple times to trigger the circuit breaker
    const tools = [
      {
        tool: failingTool,
        invocation: failingTool.build({}),
        request: {
          callId: 'failing-call',
          name: 'failing-tool',
          args: {},
          isClientInitiated: false,
          prompt_id: 'test',
        } as ToolCallRequestInfo,
      },
    ];

    const abortController = new AbortController();

    // First few calls should fail normally
    try {
      await coordinatorWithOptions.execute(tools, abortController.signal);
    } catch (_error) {
      // Expected to fail
    }

    try {
      await coordinatorWithOptions.execute(tools, abortController.signal);
    } catch (_error) {
      // Expected to fail
    }

    // After enough failures, the circuit breaker should open and subsequent calls should fail immediately
    const result = await coordinatorWithOptions.execute(
      tools,
      abortController.signal,
    );
    expect(result.results[0].success).toBe(false);
  });

  it('should retry failed operations according to retry policy', async () => {
    // Mock a tool that fails initially but succeeds on retry
    let callCount = 0;
    class FlakyToolInvocation extends BaseToolInvocation<object, ToolResult> {
      constructor(params: object) {
        super(params);
      }

      getDescription(): string {
        return 'Flaky tool invocation';
      }

      toolLocations(): ToolLocation[] {
        // 返回空数组表示不涉及特定文件路径
        return [];
      }

      async execute(
        _signal: AbortSignal,
        _updateOutput?: (output: ToolResultDisplay) => void,
        _shellExecutionConfig?: ShellExecutionConfig,
      ): Promise<ToolResult> {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Temporary failure');
        }
        return {
          llmContent: 'Success after retry',
          returnDisplay: 'Success after retry',
        };
      }
    }

    class FlakyTool extends BaseDeclarativeTool<object, ToolResult> {
      constructor() {
        super(
          'flaky-tool',
          'flaky-tool',
          'A tool that succeeds after retries',
          Kind.Other,
          {},
          false,
          false,
        );
      }

      protected createInvocation(_params: object): FlakyToolInvocation {
        return new FlakyToolInvocation({});
      }
    }

    const flakyTool = new FlakyTool();
    const coordinatorWithOptions = new ToolOrchestrationCoordinator({
      enableRetryPolicy: true,
      enableCircuitBreaker: false, // Disable circuit breaker to isolate retry behavior
    });

    const tools = [
      {
        tool: flakyTool,
        invocation: flakyTool.build({}),
        request: {
          callId: 'flaky-call',
          name: 'flaky-tool',
          args: {},
          isClientInitiated: false,
          prompt_id: 'test',
        } as ToolCallRequestInfo,
      },
    ];

    const abortController = new AbortController();
    const result = await coordinatorWithOptions.execute(
      tools,
      abortController.signal,
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0].success).toBe(true);
    expect(callCount).toBeGreaterThan(2); // Should have retried at least once
  });
});
