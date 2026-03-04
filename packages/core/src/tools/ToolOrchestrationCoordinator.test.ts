/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolOrchestrationCoordinator } from './ToolOrchestrationCoordinator.js';
import type { ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { ShellExecutionConfig } from '../services/shellExecutionService.js';
import type { ToolCallRequestInfo } from '../core/turn.js';

// 模拟工具类
class MockToolInvocation extends BaseToolInvocation<object, ToolResult> {
  constructor(params: object) {
    super(params);
  }

  getDescription(): string {
    return 'Mock tool invocation';
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
          name: 'write-file',
          args: { path: '/test.txt', content: 'hello' },
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
    expect(report['read-file']).toBeDefined();
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
});
