/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { tokenLimit } from '../core/tokenLimits.js';
import type { Content } from '@google/genai';

/**
 * Adaptive context manager that intelligently handles conversation history
 * to optimize token usage based on the specific model being used.
 */
export class AdaptiveContextManager {
  /**
   * Determines if compression should be triggered based on current token usage
   * and model-specific limits.
   */
  shouldCompress(
    currentTokenCount: number,
    model: string,
    customThreshold?: number,
  ): boolean {
    const contextLimit = tokenLimit(model, 'input');
    const threshold = customThreshold ?? 0.7; // Default to 70%

    return currentTokenCount > contextLimit * threshold;
  }

  /**
   * Calculates the optimal amount of history to preserve during compression
   * based on the model's context window and current usage.
   */
  calculatePreservationRatio(
    currentTokenCount: number,
    model: string,
    targetRatio: number = 0.3,
  ): number {
    const contextLimit = tokenLimit(model, 'input');

    // If we're significantly over the limit, preserve less history
    const overageRatio = currentTokenCount / contextLimit;
    if (overageRatio > 1.5) {
      return Math.max(0.1, targetRatio * 0.7); // Preserve only 21% if significantly over
    }

    // If we're close to the limit, preserve more history
    if (overageRatio > 0.9) {
      return Math.min(0.5, targetRatio * 1.5); // Preserve up to 45% if close to limit
    }

    // Otherwise, use the default target ratio
    return targetRatio;
  }

  /**
   * Estimates token count for content without actually counting tokens
   * (since we don't have access to a tokenizer here).
   * This is a rough approximation based on character count.
   */
  estimateTokenCount(content: Content[]): number {
    let totalChars = 0;

    for (const item of content) {
      if (item.parts) {
        for (const part of item.parts) {
          if (part.text) {
            totalChars += part.text.length;
          }
          // For simplicity, we're only counting text parts
          // In a real implementation, we'd handle other part types too
        }
      }
    }

    // Rough estimation: 1 token ~ 4 characters for English text
    return Math.ceil(totalChars / 4);
  }

  /**
   * Finds the optimal split point in conversation history based on semantic
   * importance and token preservation targets.
   * The split point divides the history into two parts:
   * - Elements before the split point: to be compressed
   * - Elements from the split point onwards: to be preserved
   */
  findOptimalSplitPoint(
    history: Content[],
    preservationRatio: number,
  ): number {
    if (preservationRatio <= 0 || preservationRatio >= 1) {
      throw new Error('Preservation ratio must be between 0 and 1');
    }

    // Calculate character counts for each content item
    const charCounts = history.map((content) => JSON.stringify(content).length);
    const totalCharCount = charCounts.reduce((a, b) => a + b, 0);

    // Calculate the target character count for content to compress
    // (which is the first part of the history, leaving the last part to preserve)
    const targetCharCount = totalCharCount * (1 - preservationRatio);

    let cumulativeCharCount = 0;
    let lastSplitPoint = 0; // 0 is always valid (compress nothing)

    for (let i = 0; i < history.length; i++) {
      const content = history[i];
      if (
        content.role === 'user' &&
        !content.parts?.some((part) => !!part.functionResponse)
      ) {
        if (cumulativeCharCount >= targetCharCount) {
          return i;
        }
        lastSplitPoint = i;
      }
      cumulativeCharCount += charCounts[i];
    }

    // We found no split points after targetCharCount.
    // Check if it's safe to compress everything.
    const lastContent = history[history.length - 1];
    if (
      lastContent?.role === 'model' &&
      !lastContent?.parts?.some((part) => part.functionCall)
    ) {
      return history.length;
    }

    // Can't compress everything so just compress at last splitpoint.
    return lastSplitPoint;
  }

  /**
   * Prepares content for compression by identifying the portion to compress
   * and the portion to preserve.
   */
  prepareForCompression(
    history: Content[],
    model: string,
    customThreshold?: number,
  ): {
    toCompress: Content[];
    toPreserve: Content[];
    shouldProceed: boolean;
  } {
    const estimatedTokens = this.estimateTokenCount(history);

    // Check if compression is needed
    if (!this.shouldCompress(estimatedTokens, model, customThreshold)) {
      return {
        toCompress: [],
        toPreserve: history,
        shouldProceed: false,
      };
    }

    // Calculate how much to preserve
    const preservationRatio = this.calculatePreservationRatio(
      estimatedTokens,
      model,
    );
    const splitPoint = this.findOptimalSplitPoint(history, preservationRatio);

    const toCompress = history.slice(0, splitPoint);
    const toPreserve = history.slice(splitPoint);

    return {
      toCompress,
      toPreserve,
      shouldProceed: toCompress.length > 0,
    };
  }
}
