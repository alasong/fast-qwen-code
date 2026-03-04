/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AnyDeclarativeTool } from './tools.js';
import type { ToolCallRequestInfo } from '../core/turn.js';
import { Kind } from './tools.js';
import { createDebugLogger } from '../utils/debugLogger.js';

const debugLogger = createDebugLogger('INTELLIGENT_TOOL_SELECTOR');

export interface ToolSelectionContext {
  userInput: string;
  conversationHistory: string;
  availableTools: AnyDeclarativeTool[];
  previousToolCalls?: ToolCallRequestInfo[];
  currentFileContext?: string;
  projectContext?: string;
}

export interface ToolSelectionResult {
  tool: AnyDeclarativeTool;
  confidence: number; // 0-1
  reason: string;
}

export interface ToolSelectionPreferences {
  preferredTools?: string[];
  avoidedTools?: string[];
  maxTools?: number;
}

export class IntelligentToolSelector {
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.3;
  private readonly PREFERENCE_BOOST = 0.1;
  private readonly HISTORY_PENALTY = 0.1;

  /**
   * 根据上下文智能选择最适合的工具
   */
  async selectBestTools(
    context: ToolSelectionContext,
    preferences: ToolSelectionPreferences = {},
  ): Promise<AnyDeclarativeTool[]> {
    debugLogger.info(
      `Selecting tools for user input: "${context.userInput.substring(0, 50)}..."`,
    );

    // 计算每个工具的置信度分数
    const scoredTools = await Promise.all(
      context.availableTools.map(async (tool) => {
        const score = await this.calculateConfidenceScore(
          tool,
          context,
          preferences,
        );
        return { tool, score };
      }),
    );

    // 按分数排序
    scoredTools.sort((a, b) => b.score - a.score);

    // 过滤掉低于阈值的工具
    const selectedTools = scoredTools
      .filter((item) => item.score > this.MIN_CONFIDENCE_THRESHOLD)
      .slice(0, preferences.maxTools || 5) // 限制返回的工具数量
      .map((item) => item.tool);

    debugLogger.info(
      `Selected ${selectedTools.length} tools out of ${context.availableTools.length}`,
    );

    return selectedTools;
  }

  /**
   * 为单个工具计算置信度分数
   */
  private async calculateConfidenceScore(
    tool: AnyDeclarativeTool,
    context: ToolSelectionContext,
    preferences: ToolSelectionPreferences,
  ): Promise<number> {
    let score = 0;

    // 1. 基于关键词匹配的分数
    score += this.calculateKeywordMatchScore(tool, context);

    // 2. 基于工具类型的分数
    score += this.calculateTypeMatchScore(tool, context);

    // 3. 基于历史使用情况的分数
    score += this.calculateHistoryScore(tool, context);

    // 4. 基于项目上下文的分数
    score += this.calculateProjectContextScore(tool, context);

    // 5. 应用偏好设置
    score = this.applyPreferences(score, tool, preferences);

    // 确保分数在0-1范围内
    return Math.max(0, Math.min(1, score));
  }

  /**
   * 基于关键词匹配计算分数
   */
  private calculateKeywordMatchScore(
    tool: AnyDeclarativeTool,
    context: ToolSelectionContext,
  ): number {
    const userInput = context.userInput.toLowerCase();
    const description = tool.description.toLowerCase();
    const name = tool.name.toLowerCase();

    let score = 0;

    // 检查名称匹配
    if (userInput.includes(name)) {
      score += 0.4;
    }

    // 检查描述匹配
    const descriptionWords = description.split(/\s+/);
    const matchedWords = descriptionWords.filter((word) =>
      userInput.includes(word),
    ).length;
    if (descriptionWords.length > 0) {
      score += (matchedWords / descriptionWords.length) * 0.3;
    }

    // 检查功能参数匹配
    if (tool.schema.parametersJsonSchema) {
      const paramStr = JSON.stringify(
        tool.schema.parametersJsonSchema,
      ).toLowerCase();
      if (paramStr.includes('file') && userInput.includes('file')) {
        score += 0.2;
      }
      if (paramStr.includes('search') && userInput.includes('search')) {
        score += 0.2;
      }
      if (paramStr.includes('read') && userInput.includes('read')) {
        score += 0.2;
      }
      if (
        paramStr.includes('edit') &&
        (userInput.includes('edit') || userInput.includes('change'))
      ) {
        score += 0.2;
      }
    }

    return Math.min(1, score);
  }

  /**
   * 基于工具类型计算分数
   */
  private calculateTypeMatchScore(
    tool: AnyDeclarativeTool,
    context: ToolSelectionContext,
  ): number {
    const userInput = context.userInput.toLowerCase();
    let score = 0;

    // 根据用户输入中的关键词调整不同类型工具的权重
    if (
      userInput.includes('read') ||
      userInput.includes('show') ||
      userInput.includes('what') ||
      userInput.includes('find')
    ) {
      if (tool.kind === Kind.Read || tool.kind === Kind.Search) {
        score += 0.5;
      }
    }

    if (
      userInput.includes('edit') ||
      userInput.includes('change') ||
      userInput.includes('update') ||
      userInput.includes('modify')
    ) {
      if (tool.kind === Kind.Edit) {
        score += 0.5;
      }
    }

    if (
      userInput.includes('run') ||
      userInput.includes('execute') ||
      userInput.includes('command') ||
      userInput.includes('shell')
    ) {
      if (tool.kind === Kind.Execute) {
        score += 0.5;
      }
    }

    if (userInput.includes('delete') || userInput.includes('remove')) {
      if (tool.kind === Kind.Delete) {
        score += 0.5;
      }
    }

    if (
      userInput.includes('search') ||
      userInput.includes('grep') ||
      userInput.includes('find')
    ) {
      if (tool.name.includes('search') || tool.name.includes('grep')) {
        score += 0.5;
      }
    }

    return Math.min(0.5, score);
  }

  /**
   * 基于历史使用情况计算分数
   */
  private calculateHistoryScore(
    tool: AnyDeclarativeTool,
    context: ToolSelectionContext,
  ): number {
    if (!context.previousToolCalls) {
      return 0;
    }

    // 如果工具最近被使用过，稍微降低分数以鼓励多样性
    const recentUse =
      context.previousToolCalls?.some((call) => call.name === tool.name) ||
      false;

    return recentUse ? -this.HISTORY_PENALTY : 0;
  }

  /**
   * 基于项目上下文计算分数
   */
  private calculateProjectContextScore(
    tool: AnyDeclarativeTool,
    context: ToolSelectionContext,
  ): number {
    if (!context.projectContext) {
      return 0;
    }

    const projectContext = context.projectContext.toLowerCase();
    let score = 0;

    // 如果工具与项目类型相关，增加分数
    if (projectContext.includes('node') || projectContext.includes('npm')) {
      if (tool.name.includes('shell') || tool.name.includes('execute')) {
        score += 0.2;
      }
    }

    if (projectContext.includes('git')) {
      if (tool.name.includes('shell') || tool.name.includes('execute')) {
        score += 0.1;
      }
    }

    return Math.min(0.3, score);
  }

  /**
   * 应用用户偏好设置
   */
  private applyPreferences(
    score: number,
    tool: AnyDeclarativeTool,
    preferences: ToolSelectionPreferences,
  ): number {
    // 如果是首选工具，增加分数
    if (preferences.preferredTools?.includes(tool.name)) {
      score += this.PREFERENCE_BOOST;
    }

    // 如果是要避免的工具，将分数设为0
    if (preferences.avoidedTools?.includes(tool.name)) {
      return 0;
    }

    return score;
  }

  /**
   * 评估工具组合的有效性
   */
  async evaluateToolCombination(
    tools: AnyDeclarativeTool[],
    context: ToolSelectionContext,
  ): Promise<number> {
    // 计算工具组合的多样性分数
    const uniqueKinds = new Set(tools.map((t) => t.kind));
    const diversityScore = uniqueKinds.size / Object.keys(Kind).length;

    // 计算组合的相关性分数
    const relevanceScores = await Promise.all(
      tools.map((tool) => this.calculateConfidenceScore(tool, context, {})),
    );
    const avgRelevance =
      relevanceScores.reduce((sum, score) => sum + score, 0) /
      relevanceScores.length;

    // 组合分数是多样性和相关性的加权平均
    return diversityScore * 0.3 + avgRelevance * 0.7;
  }
}
