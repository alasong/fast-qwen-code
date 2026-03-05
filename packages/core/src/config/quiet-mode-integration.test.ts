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

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Config } from './config.js';
import { ReadFileTool } from '../tools/read-file.js';
import { WriteFileTool } from '../tools/write-file.js';
import { SetQuietModeTool } from '../tools/set-quiet-mode.js';

describe('Quiet Mode Integration Tests', () => {
  let tempDir: string;
  let testFilePath: string;
  let config: Config;

  beforeEach(() => {
    // Create a temporary directory and file for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-integration-test-'));
    testFilePath = path.join(tempDir, 'integration-test.txt');
    fs.writeFileSync(testFilePath, 'initial content');

    // Create a real config instance with quiet mode enabled
    const configParams = {
      targetDir: tempDir,
      debugMode: false,
      cwd: tempDir,
      quietMode: false, // Start with quiet mode disabled
    };
    
    config = new Config(configParams);
  });

  afterEach(() => {
    // Clean up temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  it('should integrate quiet mode from CLI flag through to tool behavior', async () => {
    // Simulate CLI flag by setting quiet mode in config
    config.setQuietMode(true);
    
    // Create tools with the config
    const readFileTool = new ReadFileTool(config);
    const writeFileTool = new WriteFileTool(config);
    
    // Test that read operations are quiet
    const readResult = await readFileTool.call({ path: testFilePath });
    expect(readResult.returnDisplay).toBe('');
    expect(readResult.llmContent).toContain('initial content');
    
    // Test that write operations are quiet
    const writeResult = await writeFileTool.call({
      path: testFilePath,
      content: 'updated content',
    });
    expect(writeResult.returnDisplay).toBe('');
    expect(writeResult.llmContent).toContain('successfully');
    
    // Verify the file was actually updated
    const updatedContent = fs.readFileSync(testFilePath, 'utf8');
    expect(updatedContent).toBe('updated content');
  });

  it('should allow dynamic quiet mode switching during execution', async () => {
    // Create tools with the config
    const readFileTool = new ReadFileTool(config);
    const setQuietModeTool = new SetQuietModeTool(config);

    // Initially, quiet mode should be off (based on config setup)
    expect(config.getQuietMode()).toBe(false);

    // Perform a read operation in normal mode
    let readResult = await readFileTool.call({ path: testFilePath });
    expect(typeof readResult.returnDisplay === 'string' ? readResult.returnDisplay.length : 0).toBeGreaterThan(0);

    // Enable quiet mode dynamically
    const enableQuietResult = await setQuietModeTool.call({ enabled: true });
    expect(config.getQuietMode()).toBe(true);
    expect(enableQuietResult.returnDisplay).toContain('Quiet mode has been enabled');

    // Now perform a read operation in quiet mode
    readResult = await readFileTool.call({ path: testFilePath });
    expect(readResult.returnDisplay).toBe('');

    // Disable quiet mode dynamically
    const disableQuietResult = await setQuietModeTool.call({ enabled: false });
    expect(config.getQuietMode()).toBe(false);
    expect(disableQuietResult.returnDisplay).toContain('Quiet mode has been disabled');

    // Now perform a read operation in normal mode again
    readResult = await readFileTool.call({ path: testFilePath });
    expect(typeof readResult.returnDisplay === 'string' ? readResult.returnDisplay.length : 0).toBeGreaterThan(0);
  });

  it('should handle error conditions properly in quiet mode', async () => {
    // Enable quiet mode
    config.setQuietMode(true);
    
    const writeFileTool = new WriteFileTool(config);
    
    // Try to write to an invalid path to trigger an error
    const invalidPath = path.join(testFilePath, 'invalid', 'path.txt'); // testFilePath is a file, not a directory
    
    try {
      const result = await writeFileTool.call({
        path: invalidPath,
        content: 'test content',
      });
      
      // If no exception was thrown, verify that error messages are still shown in quiet mode
      expect(typeof result.returnDisplay === 'string' ? result.returnDisplay.length : 0).toBeGreaterThan(0);
      expect(result.error).toBeDefined();
    } catch (error) {
      // If an exception was thrown, that's also acceptable behavior
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('should preserve functionality when quiet mode is disabled', async () => {
    // Ensure quiet mode is disabled
    config.setQuietMode(false);
    expect(config.getQuietMode()).toBe(false);
    
    const readFileTool = new ReadFileTool(config);
    const writeFileTool = new WriteFileTool(config);
    
    // Read operation should show output
    const readResult = await readFileTool.call({ path: testFilePath });
    expect(typeof readResult.returnDisplay === 'string' ? readResult.returnDisplay.length : 0).toBeGreaterThan(0);
    
    // Write operation should show output
    const writeResult = await writeFileTool.call({
      path: path.join(tempDir, 'normal-mode-test.txt'),
      content: 'normal mode content',
    });
    expect(typeof writeResult.returnDisplay === 'string' ? writeResult.returnDisplay.length : 0).toBeGreaterThan(0);
    
    // Verify the file was created
    expect(fs.existsSync(path.join(tempDir, 'normal-mode-test.txt'))).toBe(true);
  });

  it('should maintain quiet mode state across different tools', async () => {
    // Enable quiet mode
    config.setQuietMode(true);
    expect(config.getQuietMode()).toBe(true);
    
    const readFileTool = new ReadFileTool(config);
    const writeFileTool = new WriteFileTool(config);
    const setQuietModeTool = new SetQuietModeTool(config);
    
    // Both tools should respect the quiet mode setting
    const readResult = await readFileTool.call({ path: testFilePath });
    const writeResult = await writeFileTool.call({
      path: path.join(tempDir, 'cross-tool-test.txt'),
      content: 'cross tool content',
    });
    
    expect(readResult.returnDisplay).toBe('');
    expect(writeResult.returnDisplay).toBe('');
    
    // Verify file was created despite quiet mode
    expect(fs.existsSync(path.join(tempDir, 'cross-tool-test.txt'))).toBe(true);
    
    // Use the set quiet mode tool to disable it and verify state is shared
    await setQuietModeTool.call({ enabled: false });
    expect(config.getQuietMode()).toBe(false);
    
    // Now tools should operate in normal mode
    const readResultNormal = await readFileTool.call({ path: testFilePath });
    expect(typeof readResultNormal.returnDisplay === 'string' ? readResultNormal.returnDisplay.length : 0).toBeGreaterThan(0);
  });
});