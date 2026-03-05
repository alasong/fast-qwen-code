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
import { ReadFileTool } from './read-file.js';
import { Config } from '../config/config.js';

describe('ReadFileTool with Quiet Mode', () => {
  let tempDir: string;
  let testFilePath: string;
  let mockConfig: Config;
  let readFileTool: ReadFileTool;
  let quietModeValue: boolean;

  beforeEach(() => {
    // Create a temporary directory and file for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-test-'));
    testFilePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFilePath, 'test content');

    // Initialize the shared quiet mode value
    quietModeValue = false;
    const mockWorkspaceContext = {
      isPathWithinWorkspace: (filePath: string) => filePath.startsWith(tempDir),
      getDirectories: vi.fn(() => [tempDir]),
    };
    
    mockConfig = {
      getQuietMode: () => quietModeValue,
      setQuietMode: (enabled: boolean) => { quietModeValue = enabled; },
      targetDir: tempDir,
      getWorkspaceContext: vi.fn(() => mockWorkspaceContext),
      storage: {
        getProjectTempDir: vi.fn(() => path.join(tempDir, '.temp')),
        getUserSkillsDir: vi.fn(() => path.join(os.homedir(), '.qwen', 'skills')),
      } as any,
      getFileService: vi.fn(() => ({
        shouldQwenIgnoreFile: vi.fn(() => false),
      })),
      getTargetDir: vi.fn(() => tempDir),
      getTruncateToolOutputLines: vi.fn(() => 100),
      getTruncateToolOutputThreshold: vi.fn(() => 1000),
      getUsageStatisticsEnabled: vi.fn(() => false), // Disable telemetry for tests
    } as unknown as Config;
    
    readFileTool = new ReadFileTool(mockConfig);
  });

  afterEach(() => {
    // Clean up temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  it('should return display content when quiet mode is disabled', async () => {
    // Ensure quiet mode is disabled by setting the shared variable
    quietModeValue = false;
    
    const result = await readFileTool.call({ path: testFilePath });
    
    // In normal mode, returnDisplay should contain information about the file
    expect(typeof result.returnDisplay === 'string' ? result.returnDisplay.length : 0).toBeGreaterThan(0);
    expect(result.llmContent).toContain('test content');
  });

  it('should suppress returnDisplay when quiet mode is enabled', async () => {
    // Set quiet mode as enabled
    quietModeValue = true;
    
    const result = await readFileTool.call({ path: testFilePath });
    
    // In quiet mode, returnDisplay should be empty
    expect(result.returnDisplay).toBe('');
    expect(result.llmContent).toContain('test content');
  });

  it('should still return file content to LLM in quiet mode', async () => {
    // Set quiet mode as enabled
    quietModeValue = true;
    
    const result = await readFileTool.call({ path: testFilePath });
    
    // The LLM content should still contain the file content even in quiet mode
    expect(result.llmContent).toContain('test content');
  });

  it('should handle non-existent files properly in quiet mode', async () => {
    // Set quiet mode as enabled
    quietModeValue = true;
    
    try {
      const result = await readFileTool.call({ path: path.join(tempDir, 'nonexistent.txt') });
      // If no exception was thrown, check that error handling works correctly
      expect(result.error).toBeDefined();
    } catch (error) {
      // Expected behavior - file doesn't exist
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('should work normally when quiet mode is toggled back to disabled', async () => {
    // Set quiet mode as enabled first
    quietModeValue = true;
    let result = await readFileTool.call({ path: testFilePath });
    expect(result.returnDisplay).toBe('');
    
    // Set quiet mode as disabled
    quietModeValue = false;
    result = await readFileTool.call({ path: testFilePath });
    
    // Now returnDisplay should not be empty
    expect(typeof result.returnDisplay === 'string' ? result.returnDisplay.length : 0).toBeGreaterThan(0);
    expect(result.llmContent).toContain('test content');
  });
});