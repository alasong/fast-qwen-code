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
import fs from 'fs';
import os from 'os';
import path from 'path';
import { WriteFileTool } from './write-file.js';
import type { Config } from '../config/config.js';

describe('WriteFileTool with Quiet Mode', () => {
  let tempDir: string;
  let testFilePath: string;
  let mockConfig: Config;
  let writeFileTool: WriteFileTool;
  let quietModeValue: boolean;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-test-'));
    testFilePath = path.join(tempDir, 'test.txt');

    // Initialize the shared quiet mode value
    quietModeValue = false;
    const mockWorkspaceContext = {
      isPathWithinWorkspace: (filePath: string) => filePath.startsWith(tempDir),
      getDirectories: vi.fn(() => [tempDir]),
    };

    // Create a mock config object with quiet mode functionality
    mockConfig = {
      getQuietMode: () => quietModeValue,
      setQuietMode: (enabled: boolean) => {
        quietModeValue = enabled;
      },
      targetDir: tempDir,
      getWorkspaceContext: vi.fn(() => mockWorkspaceContext),
      storage: {
        getProjectTempDir: vi.fn(() => path.join(tempDir, '.temp')),
        getUserSkillsDir: vi.fn(() =>
          path.join(os.homedir(), '.qwen', 'skills'),
        ),
      } as unknown as Config['storage'],
      getFileService: vi.fn(() => ({
        shouldQwenIgnoreFile: vi.fn(() => false),
      })),
      getTargetDir: vi.fn(() => tempDir),
      getTruncateToolOutputLines: vi.fn(() => 100),
      getTruncateToolOutputThreshold: vi.fn(() => 1000),
      getUsageStatisticsEnabled: vi.fn(() => false), // Disable telemetry for tests
      getFileSystemService: vi.fn(() => ({
        existsSync: vi.fn(() => false), // Assume file doesn't exist initially
        readTextFile: vi.fn(() => Promise.resolve(null)), // Return null if file doesn't exist
        detectFileBOM: vi.fn(() => Promise.resolve(null)), // Return null for no BOM
        writeTextFile: vi.fn(() => Promise.resolve()), // Mock successful write
      })),
    } as unknown as Config;

    writeFileTool = new WriteFileTool(mockConfig);
  });

  afterEach(() => {
    // Clean up temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_e) {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  it('should return display content when quiet mode is disabled', async () => {
    // Set quiet mode as disabled
    quietModeValue = false;

    const params = {
      path: testFilePath,
      content: 'test content',
    };

    const result = await writeFileTool.call(params);

    // In normal mode, returnDisplay should contain information about the write operation
    expect(
      typeof result.returnDisplay === 'string'
        ? result.returnDisplay.length
        : 0,
    ).toBeGreaterThan(0);
    expect(result.llmContent).toContain('successfully');
  });

  it('should suppress returnDisplay when quiet mode is enabled for successful writes', async () => {
    // Mock quiet mode as enabled
    quietModeValue = true;

    const params = {
      path: testFilePath,
      content: 'test content',
    };

    const result = await writeFileTool.call(params);

    // In quiet mode, returnDisplay should be empty for successful operations
    expect(result.returnDisplay).toBe('');
    expect(result.llmContent).toContain('successfully');
  });

  it('should still show error messages in quiet mode', async () => {
    // Mock quiet mode as enabled
    quietModeValue = true;

    // Try to write to a path that's invalid (like trying to write to a path with a file as a directory)
    const invalidPath = path.join(testFilePath, 'invalid', 'path.txt'); // testFilePath is a file, not a dir

    const params = {
      path: invalidPath,
      content: 'test content',
    };

    try {
      const result = await writeFileTool.call(params);
      // If no exception was thrown, check that error is still displayed
      expect(
        typeof result.returnDisplay === 'string'
          ? result.returnDisplay.length
          : 0,
      ).toBeGreaterThan(0);
      expect(result.error).toBeDefined();
    } catch (error) {
      // If an exception was thrown, that's also acceptable behavior
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('should still return success content to LLM in quiet mode', async () => {
    // Mock quiet mode as enabled
    quietModeValue = true;

    const params = {
      path: testFilePath,
      content: 'test content',
    };

    const result = await writeFileTool.call(params);

    // The LLM content should still contain success information even in quiet mode
    expect(result.llmContent).toContain('successfully');
  });

  it('should work normally when quiet mode is toggled back to disabled', async () => {
    // Mock quiet mode as enabled first
    quietModeValue = true;

    const params = {
      path: testFilePath,
      content: 'test content',
    };

    let result = await writeFileTool.call(params);
    expect(result.returnDisplay).toBe('');

    // Mock quiet mode as disabled
    quietModeValue = false;
    result = await writeFileTool.call(params);

    // Now returnDisplay should not be empty
    expect(
      typeof result.returnDisplay === 'string'
        ? result.returnDisplay.length
        : 0,
    ).toBeGreaterThan(0);
    expect(result.llmContent).toContain('successfully');
  });

  it('should properly handle directory creation in quiet mode', async () => {
    // Mock quiet mode as enabled
    quietModeValue = true;

    const dirPath = path.join(tempDir, 'newdir', 'test.txt');
    const params = {
      path: dirPath,
      content: 'test content',
    };

    const result = await writeFileTool.call(params);

    // Check that the file was created
    expect(fs.existsSync(dirPath)).toBe(true);

    // In quiet mode, returnDisplay should be empty for successful operations
    expect(result.returnDisplay).toBe('');
    expect(result.llmContent).toContain('successfully');
  });
});
