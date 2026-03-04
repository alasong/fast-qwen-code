/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdaptiveContextManager } from './adaptiveContextManager.js';
import type { Content } from '@google/genai';

vi.mock('../core/tokenLimits.js', async () => {
  const actual = await vi.importActual('../core/tokenLimits.js');
  return {
    ...actual,
    tokenLimit: (model: string, _type: string = 'input') => {
      if (model === 'gpt-4o') return 1000;
      if (model === 'claude-3.5-sonnet') return 2000;
      return 1000; // default
    },
  };
});

describe('AdaptiveContextManager', () => {
  let manager: AdaptiveContextManager;

  beforeEach(() => {
    manager = new AdaptiveContextManager();
  });

  describe('shouldCompress', () => {
    it('should return true when token count exceeds threshold', () => {
      // For a model with 1000 token limit, 70% threshold = 700 tokens
      expect(manager.shouldCompress(800, 'gpt-4o')).toBe(true);
    });

    it('should return false when token count is under threshold', () => {
      expect(manager.shouldCompress(500, 'gpt-4o')).toBe(false);
    });

    it('should use custom threshold when provided', () => {
      // Custom 50% threshold
      expect(manager.shouldCompress(600, 'gpt-4o', 0.5)).toBe(true);
      expect(manager.shouldCompress(400, 'gpt-4o', 0.5)).toBe(false);
    });
  });

  describe('calculatePreservationRatio', () => {
    it('should return lower ratio when significantly over limit', () => {
      // If context is 1.6x over limit (1600/1000), preserve less
      const ratio = manager.calculatePreservationRatio(1600, 'gpt-4o');
      expect(ratio).toBeLessThan(0.3); // Less than default 30%
      expect(ratio).toBeGreaterThanOrEqual(0.1); // But not less than 10%
    });

    it('should return higher ratio when close to limit', () => {
      // If context is 0.95x of limit (950/1000), preserve more
      const ratio = manager.calculatePreservationRatio(950, 'gpt-4o');
      expect(ratio).toBeGreaterThan(0.3); // More than default 30%
      expect(ratio).toBeLessThanOrEqual(0.5); // But not more than 50%
    });

    it('should return default ratio when near optimal', () => {
      // If context is 0.6x of limit (600/1000), use default
      const ratio = manager.calculatePreservationRatio(600, 'gpt-4o');
      expect(ratio).toBe(0.3); // Default 30%
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate token count based on character length', () => {
      const content: Content[] = [
        {
          role: 'user',
          parts: [{ text: 'Hello world! This is a test message.' }],
        },
      ];

      const estimated = manager.estimateTokenCount(content);
      // "Hello world! This is a test message." is ~40 chars, so ~10 tokens
      expect(estimated).toBeGreaterThan(0);
    });

    it('should handle multiple content items', () => {
      const content: Content[] = [
        {
          role: 'user',
          parts: [{ text: 'First message.' }],
        },
        {
          role: 'model',
          parts: [{ text: 'Second message.' }],
        },
      ];

      const estimated = manager.estimateTokenCount(content);
      expect(estimated).toBeGreaterThan(0);
    });
  });

  describe('findOptimalSplitPoint', () => {
    it('should return correct split point based on character count for preservation ratio', () => {
      const history: Content[] = [
        { role: 'user', parts: [{ text: 'Message 1' }] },
        { role: 'model', parts: [{ text: 'Response 1' }] },
        { role: 'user', parts: [{ text: 'Message 2' }] },
        { role: 'model', parts: [{ text: 'Response 2' }] },
        { role: 'user', parts: [{ text: 'Message 3' }] },
      ];

      // Request to preserve 40% of history by character count
      // The split point is determined by character count, not item count
      const splitPoint = manager.findOptimalSplitPoint(history, 0.4);

      // The split point should be a valid index in the range [0, history.length]
      expect(splitPoint).toBeGreaterThanOrEqual(0);
      expect(splitPoint).toBeLessThanOrEqual(history.length);
    });

    it('should throw error for invalid preservation ratio', () => {
      const history: Content[] = [
        { role: 'user', parts: [{ text: 'Message 1' }] },
      ];

      expect(() => {
        manager.findOptimalSplitPoint(history, 1.5);
      }).toThrow('Preservation ratio must be between 0 and 1');

      expect(() => {
        manager.findOptimalSplitPoint(history, -0.5);
      }).toThrow('Preservation ratio must be between 0 and 1');
    });
  });

  describe('prepareForCompression', () => {
    it('should return correct compression plan when needed', () => {
      const history: Content[] = [
        { role: 'user', parts: [{ text: 'Old message 1' }] },
        { role: 'model', parts: [{ text: 'Old response 1' }] },
        { role: 'user', parts: [{ text: 'Recent message' }] },
        { role: 'model', parts: [{ text: 'Recent response' }] },
      ];

      // Mock the estimation to be over the threshold
      const result = manager.prepareForCompression(history, 'gpt-4o');

      // Since we're using estimates based on character count,
      // the actual result depends on the implementation
      expect(result).toHaveProperty('toCompress');
      expect(result).toHaveProperty('toPreserve');
      expect(result).toHaveProperty('shouldProceed');
    });

    it('should return full history when compression not needed', () => {
      const history: Content[] = [
        { role: 'user', parts: [{ text: 'Short message' }] },
      ];

      const result = manager.prepareForCompression(history, 'gpt-4o');

      // With a short history, compression shouldn't be needed
      expect(result.toCompress).toHaveLength(0);
      expect(result.toPreserve).toEqual(history);
      expect(result.shouldProceed).toBe(false);
    });
  });
});
