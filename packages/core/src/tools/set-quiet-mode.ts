/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import type { ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolNames, ToolDisplayNames } from './tool-names.js';

/**
 * Parameters for the SetQuietMode tool
 */
export interface SetQuietModeToolParams {
  /**
   * Whether to enable or disable quiet mode
   */
  enabled: boolean;
}

class SetQuietModeToolInvocation extends BaseToolInvocation<
  SetQuietModeToolParams,
  ToolResult
> {
  constructor(
    private config: Config,
    params: SetQuietModeToolParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return `Setting quiet mode to ${this.params.enabled ? 'enabled' : 'disabled'}`;
  }

  async execute(): Promise<ToolResult> {
    this.config.setQuietMode(this.params.enabled);

    const message = this.params.enabled
      ? 'Quiet mode has been enabled. File operations will not display output.'
      : 'Quiet mode has been disabled. File operations will display output.';

    return {
      llmContent: message,
      returnDisplay: message,
    };
  }
}

/**
 * Implementation of the SetQuietMode tool logic
 * Allows users to dynamically toggle quiet mode during execution
 */
export class SetQuietModeTool extends BaseDeclarativeTool<
  SetQuietModeToolParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.SET_QUIET_MODE;

  constructor(private config: Config) {
    super(
      SetQuietModeTool.Name,
      ToolDisplayNames.SET_QUIET_MODE,
      `Allows users to dynamically toggle quiet mode during execution. When enabled, file read/write operations will not display output, but errors will still be shown.`,
      Kind.Edit,
      {
        properties: {
          enabled: {
            description: 'Whether to enable or disable quiet mode',
            type: 'boolean',
          },
        },
        required: ['enabled'],
        type: 'object',
      },
    );
  }

  protected createInvocation(
    params: SetQuietModeToolParams,
  ): SetQuietModeToolInvocation {
    return new SetQuietModeToolInvocation(this.config, params);
  }

  /**
   * Convenience method to call the tool directly with parameters
   */
  async call(params: SetQuietModeToolParams): Promise<ToolResult> {
    const invocation = this.build(params);
    return invocation.execute(new AbortController().signal);
  }
}
