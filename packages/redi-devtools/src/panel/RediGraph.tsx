import type { DevtoolsDependencyGraphSnapshot } from '@wendellhu/redi';
import * as d3 from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface RediGraphProps {
  snapshot: DevtoolsDependencyGraphSnapshot;
}

interface TreeNode {
  id: string;
  label: string;
  type: 'injector' | 'token';
  injectorId?: string;
  instantiated?: boolean;
  isTokenContainer?: boolean; // 标记是否为token容器节点
  children?: TreeNode[];
  parent?: TreeNode;
  depth?: number;
  x?: number;
  y?: number;
}

interface TreeLink {
  source: TreeNode;
  target: TreeNode;
  type: 'dependency' | 'parent';
}

export function RediGraph(props: RediGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const initializedRef = useRef(false);

  // 响应式调整画布尺寸
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // 构建层次图数据
  const { treeNodes, treeLinks } = useMemo(() => {
    const { tokens, injectors, edges } = props.snapshot;

    // 创建节点映射
    const nodeMap = new Map<string, TreeNode>();

    // 首先创建所有injector节点
    injectors.forEach((inj) => {
      nodeMap.set(inj.id, {
        id: inj.id,
        label: inj.name ? `${inj.name} (${inj.id})` : inj.id,
        type: 'injector' as const,
        children: [],
      });
    });

    // 建立injector父子关系
    injectors.forEach((inj) => {
      if (inj.parentId) {
        const parent = nodeMap.get(inj.parentId);
        const child = nodeMap.get(inj.id);
        if (parent && child) {
          if (!parent.children) parent.children = [];
          parent.children.push(child);
          child.parent = parent;
        }
      }
    });

    // 为每个injector创建token容器节点
    const tokenContainerMap = new Map<string, TreeNode>();
    injectors.forEach((inj) => {
      const containerNode: TreeNode = {
        id: `token-container-${inj.id}`,
        label: 'Tokens',
        type: 'injector' as const, // 使用injector类型，但特殊处理
        injectorId: inj.id,
        isTokenContainer: true,
        children: [],
      };
      tokenContainerMap.set(inj.id, containerNode);
      nodeMap.set(containerNode.id, containerNode);

      // 将容器节点添加到对应的injector
      const injector = nodeMap.get(inj.id);
      if (injector) {
        if (!injector.children) injector.children = [];
        injector.children.push(containerNode);
        containerNode.parent = injector;
      }
    });

    // 创建token节点并添加到对应的token容器
    tokens.forEach((token) => {
      const tokenNode: TreeNode = {
        id: token.key,
        label: token.label,
        type: 'token' as const,
        injectorId: token.injectorId,
        instantiated: token.instantiated,
      };

      nodeMap.set(token.key, tokenNode);

      // 将token添加到对应的token容器
      const container = tokenContainerMap.get(token.injectorId);
      if (container) {
        if (!container.children) container.children = [];
        container.children.push(tokenNode);
        tokenNode.parent = container;
      }
    });

    // 找到根节点（没有父节点的injector）
    const rootNodes = Array.from(nodeMap.values()).filter(
      (node) => node.type === 'injector' && !node.parent,
    );

    // 如果没有根节点，创建一个虚拟根节点
    let root: TreeNode;
    if (rootNodes.length === 0) {
      root = {
        id: 'virtual-root',
        label: 'Root',
        type: 'injector' as const,
        children: Array.from(nodeMap.values()).filter((node) => !node.parent),
      };
    } else if (rootNodes.length === 1) {
      root = rootNodes[0];
    } else {
      // 多个根节点，创建一个虚拟根节点
      root = {
        id: 'virtual-root',
        label: 'Multiple Roots',
        type: 'injector' as const,
        children: rootNodes,
      };
    }

    // 计算深度
    const calculateDepth = (node: TreeNode, depth: number = 0) => {
      node.depth = depth;
      if (node.children) {
        node.children.forEach((child) => calculateDepth(child, depth + 1));
      }
    };
    calculateDepth(root);

    // 创建依赖边
    const dependencyLinks: TreeLink[] = edges
      .map((edge) => {
        const source = nodeMap.get(edge.from);
        const target = nodeMap.get(edge.to);
        if (source && target) {
          return {
            source,
            target,
            type: 'dependency' as const,
          };
        }
        return null;
      })
      .filter(Boolean) as TreeLink[];

    // 创建层次结构数据（用于D3树布局）
    const hierarchy = d3.hierarchy(root);

    return {
      treeNodes: Array.from(nodeMap.values()),
      treeLinks: dependencyLinks,
      hierarchy,
      root,
    };
  }, [
    props.snapshot.tokens,
    props.snapshot.injectors,
    props.snapshot.edges,
  ]);

  // 初始化D3层次图可视化
  useEffect(() => {
    if (!svgRef.current || treeNodes.length === 0) return;

    // 如果已经初始化，跳过重新初始化
    if (initializedRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    const width = dimensions.width;
    const height = dimensions.height;

    // 清空之前的可视化
    svg.selectAll('*').remove();

    // 创建主分组
    const g = svg.append('g');

    // 创建缩放行为
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // 创建树状布局 - 水平布局（根在左侧，子节点向右延伸）
    const treeLayout = d3.tree<TreeNode>()
      .size([width - 100, height - 100]) // 水平布局：宽度为x轴，高度为y轴
      .separation((a, b) => {
        // 根据节点类型调整间距
        const aData = a.data as TreeNode;
        const bData = b.data as TreeNode;

        // 检查是否为容器节点
        const aIsContainer = aData.isTokenContainer;
        const bIsContainer = bData.isTokenContainer;

        if (aData.type === 'injector' && bData.type === 'injector') {
          if (aIsContainer && bIsContainer) {
            return 1.5; // 容器节点之间
          }
          if (aIsContainer || bIsContainer) {
            return 2; // 容器节点与普通injector节点之间
          }
          return 2; // 普通injector节点之间
        }

        if (aData.type === 'token' && bData.type === 'token') {
          return 3; // token节点之间使用更大的间距
        }

        // 混合类型节点（injector 和 token）之间
        if (aIsContainer || bIsContainer) {
          return 2.5; // 容器节点与token节点之间
        }
        return 2; // 普通injector与token节点之间
      });

    // 重新构建层次结构（因为我们需要更新后的位置）
    const rootNode = treeNodes.find((n) => !n.parent) || treeNodes[0];
    const hierarchy = d3.hierarchy(rootNode);
    const treeData = treeLayout(hierarchy);

    // 获取所有节点和链接
    const nodes = treeData.descendants();
    const links = treeData.links();

    // 创建链接（边）
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('d', d3.linkHorizontal()
        .x((d: any) => d.x)
        .y((d: any) => d.y) as any)
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.6);

    // 创建节点
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d: any) => {
        // 点击节点时高亮相关连接
        event.stopPropagation();

        // 重置所有样式
        link
          .attr('stroke', '#94a3b8')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.6);

        node.select('circle')
          .attr('stroke', (d: any) => {
            const nodeData = d.data as TreeNode;
            if (nodeData.type === 'injector') {
              if (nodeData.isTokenContainer) return '#f59e0b';
              return '#4f46e5';
            }
            return nodeData.instantiated ? '#059669' : '#d97706';
          })
          .attr('stroke-width', 2);

        // 高亮当前节点和它的连接
        const currentNode = d as d3.HierarchyPointNode<TreeNode>;

        // 高亮父链接
        if (currentNode.parent) {
          link
            .filter((l: any) => l.target === currentNode)
            .attr('stroke', '#ef4444')
            .attr('stroke-width', 3)
            .attr('opacity', 1);
        }

        // 高亮子链接
        link
          .filter((l: any) => l.source === currentNode)
          .attr('stroke', '#ef4444')
          .attr('stroke-width', 3)
          .attr('opacity', 1);

        // 高亮依赖链接
        const nodeId = (currentNode.data as TreeNode).id;
        const _dependencyLinks = treeLinks.filter(
          (l) => l.source.id === nodeId || l.target.id === nodeId,
        );

        // 高亮当前节点
        node
          .filter((n: any) => (n.data as TreeNode).id === nodeId)
          .select('circle')
          .attr('stroke', '#ef4444')
          .attr('stroke-width', 4);
      });

    // 添加节点圆形
    node
      .append('circle')
      .attr('r', (d) => {
        const nodeData = d.data as TreeNode;
        if (nodeData.type === 'injector') {
          if (nodeData.isTokenContainer) return 15; // 容器节点稍小
          return 20;
        }
        return nodeData.instantiated ? 10 : 6;
      })
      .attr('fill', (d) => {
        const nodeData = d.data as TreeNode;
        if (nodeData.type === 'injector') {
          if (nodeData.isTokenContainer) return '#fef3c7'; // 容器节点用淡黄色
          return '#e0e7ff';
        }
        return nodeData.instantiated ? '#10b981' : '#fbbf24';
      })
      .attr('stroke', (d) => {
        const nodeData = d.data as TreeNode;
        if (nodeData.type === 'injector') {
          if (nodeData.isTokenContainer) return '#f59e0b'; // 容器节点用橙色边框
          return '#4f46e5';
        }
        return nodeData.instantiated ? '#059669' : '#d97706';
      })
      .attr('stroke-width', 2);

    // 添加节点标签
    node
      .append('text')
      .attr('dy', (d) => {
        const nodeData = d.data as TreeNode;
        if (nodeData.type === 'injector') return -25;
        return 20;
      })
      .attr('text-anchor', 'middle')
      .attr('font-size', (d) => {
        const nodeData = d.data as TreeNode;
        return nodeData.type === 'injector' ? '12px' : '10px';
      })
      .attr('fill', (d) => {
        const nodeData = d.data as TreeNode;
        return nodeData.type === 'injector' ? '#1e293b' : '#475569';
      })
      .text((d) => {
        const nodeData = d.data as TreeNode;
        if (nodeData.type === 'injector') return nodeData.label;
        // 对于token，显示简短标签
        const maxLength = 20;
        return nodeData.label.length > maxLength
          ? `${nodeData.label.substring(0, maxLength)}...`
          : nodeData.label;
      });

    // 添加tooltip
    node
      .append('title')
      .text((d) => {
        const nodeData = d.data as TreeNode;
        if (nodeData.type === 'injector') {
          if (nodeData.isTokenContainer) {
            const tokenCount = nodeData.children?.length || 0;
            return `${nodeData.label} (${tokenCount} tokens)`;
          }
          const childCount = nodeData.children?.length || 0;
          return `${nodeData.label} (${childCount} children)`;
        }
        return `${nodeData.label}${nodeData.instantiated ? ' (instantiated)' : ' (not instantiated)'}`;
      });

    // 添加依赖边（虚线，表示依赖关系）
    const dependencyLinkGroup = g.append('g')
      .attr('class', 'dependency-links');

    treeLinks.forEach((linkData) => {
      const sourceNode = nodes.find((n) => (n.data as TreeNode).id === linkData.source.id);
      const targetNode = nodes.find((n) => (n.data as TreeNode).id === linkData.target.id);

      if (sourceNode && targetNode) {
        dependencyLinkGroup
          .append('path')
          .attr('d', `M ${sourceNode.x},${sourceNode.y} L ${targetNode.x},${targetNode.y}`)
          .attr('fill', 'none')
          .attr('stroke', '#ef4444')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '5,5')
          .attr('opacity', 0.4)
          .append('title')
          .text(`Dependency: ${linkData.source.label} → ${linkData.target.label}`);
      }
    });

    // 添加画布点击事件（重置高亮）
    svg.on('click', (event: MouseEvent) => {
      // 点击画布时重置所有高亮
      if (event.target === svg.node()) {
        link
          .attr('stroke', '#94a3b8')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.6);

        node.select('circle')
          .attr('stroke', (d: any) => {
            const nodeData = d.data as TreeNode;
            if (nodeData.type === 'injector') {
              if (nodeData.isTokenContainer) return '#f59e0b';
              return '#4f46e5';
            }
            return nodeData.instantiated ? '#059669' : '#d97706';
          })
          .attr('stroke-width', 2);

        dependencyLinkGroup
          .selectAll('path')
          .attr('opacity', 0.4);
      }
    });

    // 初始居中视图
    setTimeout(() => {
      const nodeElements = node.nodes() as SVGGElement[];
      const bounds = nodeElements.reduce(
        (acc, n) => {
          const bbox = n.getBBox();
          const transform = n.getAttribute('transform');
          if (transform) {
            const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
            if (match) {
              const x = Number.parseFloat(match[1]);
              const y = Number.parseFloat(match[2]);
              return {
                minX: Math.min(acc.minX, x + bbox.x),
                minY: Math.min(acc.minY, y + bbox.y),
                maxX: Math.max(acc.maxX, x + bbox.x + bbox.width),
                maxY: Math.max(acc.maxY, y + bbox.y + bbox.height),
              };
            }
          }
          return acc;
        },
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      );

      const graphWidth = bounds.maxX - bounds.minX;
      const graphHeight = bounds.maxY - bounds.minY;
      const scale = Math.min(width / graphWidth, height / graphHeight) * 0.8;
      const translateX = width / 2 - (bounds.minX + graphWidth / 2) * scale;
      const translateY = height / 2 - (bounds.minY + graphHeight / 2) * scale;

      svg
        .transition()
        .duration(750)
        .call(
          zoom.transform as any,
          d3.zoomIdentity.translate(translateX, translateY).scale(scale),
        );
    }, 100);

    initializedRef.current = true;

    // 清理函数
    return () => {
      initializedRef.current = false;
    };
  }, [treeNodes, treeLinks, dimensions]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
      }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ display: 'block' }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          backgroundColor: 'white',
          padding: '8px 12px',
          borderRadius: 6,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          fontSize: '12px',
          color: '#475569',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div>
          Nodes:
          {' '}
          <strong>{treeNodes.length}</strong>
          {' | '}
          Dependencies:
          {' '}
          <strong>{treeLinks.length}</strong>
        </div>
        <div style={{ fontSize: '10px', color: '#64748b' }}>
          • Injectors: ● Purple circles
          <br />
          • Tokens: ● Green (instantiated) ● Yellow (not instantiated)
          <br />
          • Dependencies: Red dashed lines
        </div>
        <div style={{ fontSize: '10px', color: '#64748b' }}>
          Click node to highlight • Scroll to zoom • Click background to reset
        </div>
      </div>
    </div>
  );
}
