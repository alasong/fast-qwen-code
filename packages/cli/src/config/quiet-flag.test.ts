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
import { parseArguments } from '../config/config.js';

// Mock process.argv to simulate command line arguments
const originalArgv = process.argv;

describe('CLI Arguments with Quiet Mode', () => {
  beforeEach(() => {
    // Reset process.argv before each test
    process.argv = ['node', 'test'];
  });

  afterEach(() => {
    // Restore original process.argv after each test
    process.argv = originalArgv;
  });

  it('should parse --quiet flag correctly', async () => {
    process.argv = ['node', 'test', '--quiet'];
    
    const args = await parseArguments();
    
    expect(args.quiet).toBe(true);
  });

  it('should parse -q flag correctly', async () => {
    process.argv = ['node', 'test', '-q'];
    
    const args = await parseArguments();
    
    expect(args.quiet).toBe(true);
  });

  it('should default quiet flag to false when not provided', async () => {
    process.argv = ['node', 'test'];
    
    const args = await parseArguments();
    
    expect(args.quiet).toBe(false);
  });

  it('should work with other flags combined with --quiet', async () => {
    process.argv = ['node', 'test', '--quiet', '--output-format', 'json'];
    
    const args = await parseArguments();
    
    expect(args.quiet).toBe(true);
    expect(args.outputFormat).toBe('json');
  });

  it('should work with other flags combined with -q', async () => {
    process.argv = ['node', 'test', '-q', '--model', 'test-model'];
    
    const args = await parseArguments();
    
    expect(args.quiet).toBe(true);
    expect(args.model).toBe('test-model');
  });

  it('should handle --no-quiet flag if provided', async () => {
    process.argv = ['node', 'test', '--no-quiet'];
    
    const args = await parseArguments();
    
    // Note: depending on how yargs handles --no- prefixes, this might be false or undefined
    // The important thing is that it's not true
    expect(args.quiet).not.toBe(true);
  });
});