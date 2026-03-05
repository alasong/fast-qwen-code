/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use more than 100 characters in a line
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { SetQuietModeToolParams } from './set-quiet-mode.js';
import { SetQuietModeTool } from './set-quiet-mode.js';
import type { Config } from '../config/config.js';

describe('SetQuietModeTool', () => {
  let mockConfig: Config;
  let setQuietModeTool: SetQuietModeTool;

  beforeEach(() => {
    // Create a mock config object with the necessary methods
    mockConfig = {
      getQuietMode: vi.fn(() => false),
      setQuietMode: vi.fn(),
    } as Partial<Config> as Config;

    setQuietModeTool = new SetQuietModeTool(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should have the correct name', () => {
    expect(setQuietModeTool.name).toBe('set_quiet_mode');
  });

  it('should have the correct description', () => {
    const description = setQuietModeTool.description;
    expect(description).toContain(
      'Allows users to dynamically toggle quiet mode',
    );
    expect(description).toContain(
      'file read/write operations will not display output',
    );
  });

  it('should have the correct schema', () => {
    const schema = setQuietModeTool.schema;
    const propertiesJsonSchema = schema.parametersJsonSchema as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(propertiesJsonSchema.properties['enabled']).toBeDefined();
    expect(
      (propertiesJsonSchema.properties['enabled'] as { type: string }).type,
    ).toBe('boolean');
    expect(propertiesJsonSchema.required).toContain('enabled');
  });

  describe('execution', () => {
    it('should enable quiet mode when enabled=true', async () => {
      const params: SetQuietModeToolParams = { enabled: true };

      const result = await setQuietModeTool.call(params);

      expect(mockConfig.setQuietMode).toHaveBeenCalledWith(true);
      expect(result.llmContent).toContain('Quiet mode has been enabled');
      expect(result.returnDisplay).toContain('Quiet mode has been enabled');
    });

    it('should disable quiet mode when enabled=false', async () => {
      const params: SetQuietModeToolParams = { enabled: false };

      const tool = new SetQuietModeTool(mockConfig);
      const result = await tool.call(params);

      expect(mockConfig.setQuietMode).toHaveBeenCalledWith(false);
      expect(result.llmContent).toContain('Quiet mode has been disabled');
      expect(result.returnDisplay).toContain('Quiet mode has been disabled');
    });

    it('should return appropriate messages when enabling', async () => {
      const params: SetQuietModeToolParams = { enabled: true };
      const result = await setQuietModeTool.call(params);

      expect(result.llmContent).toContain('Quiet mode has been enabled');
      expect(result.llmContent).toContain(
        'File operations will not display output',
      );
      expect(result.returnDisplay).toContain('Quiet mode has been enabled');
    });

    it('should return appropriate messages when disabling', async () => {
      const params: SetQuietModeToolParams = { enabled: false };
      const result = await setQuietModeTool.call(params);

      expect(result.llmContent).toContain('Quiet mode has been disabled');
      expect(result.llmContent).toContain(
        'File operations will display output',
      );
      expect(result.returnDisplay).toContain('Quiet mode has been disabled');
    });
  });
});
