/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AnyDeclarativeTool, AnyToolInvocation } from './tools.js';
import type { ToolCallRequestInfo } from '../core/turn.js';
import { Kind } from './tools.js';

export interface DependencyGraph {
  nodes: ToolGraphNode[];
  edges: DependencyEdge[];
}

export interface ToolGraphNode {
  id: string;
  tool: AnyDeclarativeTool;
  invocation: AnyToolInvocation;
  request: ToolCallRequestInfo;
}

export interface DependencyEdge {
  from: string; // 节点ID
  to: string; // 节点ID
  type: 'data_dependency' | 'resource_conflict' | 'order_dependency';
}

export interface ToolExecutionPlan {
  batches: ToolExecutionBatch[];
}

export interface ToolExecutionBatch {
  tools: Array<{
    id: string;
    tool: AnyDeclarativeTool;
    invocation: AnyToolInvocation;
    request: ToolCallRequestInfo;
  }>;
}

export class ToolDependencyResolver {
  /**
   * 分析工具调用之间的依赖关系并生成执行计划
   */
  resolve(
    tools: Array<{
      tool: AnyDeclarativeTool;
      invocation: AnyToolInvocation;
      request: ToolCallRequestInfo;
    }>,
  ): ToolExecutionPlan {
    const nodes: ToolGraphNode[] = tools.map((item, index) => ({
      id: `${item.request.callId}-${index}`,
      ...item,
    }));

    const edges: DependencyEdge[] = this.buildDependencyGraph(nodes);

    // 使用拓扑排序生成执行批次
    return this.topologicalSort(nodes, edges);
  }

  private buildDependencyGraph(nodes: ToolGraphNode[]): DependencyEdge[] {
    const edges: DependencyEdge[] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        // 检查是否有数据依赖（例如，一个工具的输出是另一个工具的输入）
        const dataDep = this.checkDataDependency(nodeA, nodeB);
        if (dataDep) {
          edges.push(dataDep);
        }

        // 检查是否有资源冲突（例如，同时修改同一文件）
        const resourceConflict = this.checkResourceConflict(nodeA, nodeB);
        if (resourceConflict) {
          edges.push(resourceConflict);
        }
      }
    }

    return edges;
  }

  /**
   * 检查两个工具之间是否存在数据依赖关系
   */
  private checkDataDependency(
    nodeA: ToolGraphNode,
    nodeB: ToolGraphNode,
  ): DependencyEdge | null {
    // 检查A的输出是否是B的输入（简化版检查）
    // 在实际实现中，这可能需要更复杂的上下文分析
    const aLocations = nodeA.invocation.toolLocations();
    const bLocations = nodeB.invocation.toolLocations();

    // 如果A和B操作相同的资源，则可能存在依赖关系
    for (const aLoc of aLocations) {
      for (const bLoc of bLocations) {
        if (aLoc.path === bLoc.path) {
          // 根据工具类型确定依赖方向
          // 写操作应该在读操作之前
          if (
            this.isWriteOperation(nodeA.tool) &&
            this.isReadOperation(nodeB.tool)
          ) {
            // A是写操作，B是读操作：A -> B (A先执行，B后读取)
            return {
              from: nodeA.id,
              to: nodeB.id,
              type: 'data_dependency',
            };
          } else if (
            this.isReadOperation(nodeA.tool) &&
            this.isWriteOperation(nodeB.tool)
          ) {
            // A是读操作，B是写操作：A -> B (A先读取旧版本，B后写入)
            return {
              from: nodeA.id,
              to: nodeB.id,
              type: 'data_dependency',
            };
          } else if (
            this.isWriteOperation(nodeA.tool) &&
            this.isWriteOperation(nodeB.tool)
          ) {
            // A和B都是写操作：A -> B (按某种顺序执行，避免并发写入)
            // 为避免循环，总是按照ID顺序安排
            return {
              from: nodeA.id,
              to: nodeB.id,
              type: 'resource_conflict',
            };
          }
          // 其他情况（如都是读操作）不需要依赖关系
        }
      }
    }

    return null;
  }

  /**
   * 检查两个工具之间是否存在资源冲突
   */
  private checkResourceConflict(
    nodeA: ToolGraphNode,
    nodeB: ToolGraphNode,
  ): DependencyEdge | null {
    const aLocations = nodeA.invocation.toolLocations();
    const bLocations = nodeB.invocation.toolLocations();

    for (const aLoc of aLocations) {
      for (const bLoc of bLocations) {
        if (aLoc.path === bLoc.path) {
          // 如果两个工具都访问相同的资源，可能存在冲突
          return {
            from: nodeA.id,
            to: nodeB.id,
            type: 'resource_conflict',
          };
        }
      }
    }

    return null;
  }

  private isWriteOperation(tool: AnyDeclarativeTool): boolean {
    return [Kind.Edit, Kind.Delete, Kind.Move, Kind.Execute].includes(
      tool.kind,
    );
  }

  private isReadOperation(tool: AnyDeclarativeTool): boolean {
    return [Kind.Read, Kind.Search, Kind.Fetch, Kind.Think].includes(tool.kind);
  }

  /**
   * 使用拓扑排序算法生成工具执行批次
   */
  private topologicalSort(
    nodes: ToolGraphNode[],
    edges: DependencyEdge[],
  ): ToolExecutionPlan {
    // 构建邻接表和入度数组
    const adjList: Map<string, string[]> = new Map();
    const inDegree: Map<string, number> = new Map();

    // 初始化所有节点
    for (const node of nodes) {
      adjList.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    // 构建图
    for (const edge of edges) {
      adjList.get(edge.from)!.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    // 找到所有入度为0的节点
    const queue: string[] = [];
    for (const [nodeId] of inDegree) {
      if (inDegree.get(nodeId) === 0) {
        queue.push(nodeId);
      }
    }

    const batches: ToolExecutionBatch[] = [];
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    // 拓扑排序
    while (queue.length > 0) {
      const currentBatch: ToolExecutionBatch['tools'] = [];

      // 处理当前批次的所有节点
      const batchSize = queue.length;
      for (let i = 0; i < batchSize; i++) {
        const nodeId = queue.shift()!;
        const node = nodeMap.get(nodeId)!;

        currentBatch.push({
          id: node.id,
          tool: node.tool,
          invocation: node.invocation,
          request: node.request,
        });

        // 更新相邻节点的入度
        for (const neighborId of adjList.get(nodeId)!) {
          const newInDegree = (inDegree.get(neighborId) || 0) - 1;
          inDegree.set(neighborId, newInDegree);

          if (newInDegree === 0) {
            queue.push(neighborId);
          }
        }
      }

      if (currentBatch.length > 0) {
        batches.push({ tools: currentBatch });
      }
    }

    // 检查是否有环
    if (batches.flat().length !== nodes.length) {
      throw new Error('Circular dependency detected in tool calls');
    }

    return { batches };
  }
}
