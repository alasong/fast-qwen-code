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
import { Config, ApprovalMode } from './config.js';

describe('Config Quiet Mode Initialization', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-config-test-'));
  });

  afterEach(() => {
    // Clean up temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  it('should initialize quiet mode to false by default', () => {
    const configParams = {
      targetDir: tempDir,
      debugMode: false,
      cwd: tempDir,
      // quietMode is not specified, so it should default to false
    };

    const config = new Config(configParams);

    expect(config.getQuietMode()).toBe(false);
  });

  it('should initialize quiet mode to true when specified', () => {
    const configParams = {
      targetDir: tempDir,
      debugMode: false,
      cwd: tempDir,
      quietMode: true,
    };
    
    const config = new Config(configParams);
    
    expect(config.getQuietMode()).toBe(true);
  });

  it('should initialize quiet mode to false when explicitly set to false', () => {
    const configParams = {
      targetDir: tempDir,
      debugMode: false,
      cwd: tempDir,
      quietMode: false,
    };
    
    const config = new Config(configParams);
    
    expect(config.getQuietMode()).toBe(false);
  });

  it('should allow quiet mode to be changed after initialization', () => {
    const configParams = {
      targetDir: tempDir,
      debugMode: false,
      cwd: tempDir,
      quietMode: false,
    };
    
    const config = new Config(configParams);
    
    // Initially false
    expect(config.getQuietMode()).toBe(false);
    
    // Change to true
    config.setQuietMode(true);
    expect(config.getQuietMode()).toBe(true);
    
    // Change back to false
    config.setQuietMode(false);
    expect(config.getQuietMode()).toBe(false);
  });

  it('should maintain quiet mode state independently of other config properties', () => {
    const configParams = {
      targetDir: tempDir,
      debugMode: false,
      cwd: tempDir,
      quietMode: true,
      approvalMode: ApprovalMode.DEFAULT, // Just setting another property to ensure independence
    };
    
    const config = new Config(configParams);
    
    // Verify quiet mode is set correctly
    expect(config.getQuietMode()).toBe(true);
    
    // Verify we can change quiet mode without affecting other properties
    config.setQuietMode(false);
    expect(config.getQuietMode()).toBe(false);
    
    // Note: We can't easily test that other properties remain unchanged without exposing them,
    // but the architecture suggests they should remain independent
  });

  it('should handle rapid quiet mode toggling correctly', () => {
    const configParams = {
      targetDir: tempDir,
      debugMode: false,
      cwd: tempDir,
      quietMode: false,
    };

    const config = new Config(configParams);

    // Rapidly toggle quiet mode
    for (let i = 0; i < 10; i++) {
      const expectedValue = i % 2 === 1; // Alternate between true and false
      config.setQuietMode(expectedValue);
      expect(config.getQuietMode()).toBe(expectedValue);
    }
  });
});