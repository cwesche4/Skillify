import { Node, Edge } from 'reactflow'
import { useFlowStore } from './useFlowStore'

export const FlowActions = {
  addNode(node: Node) {
    const { nodes, setNodes } = useFlowStore.getState()
    setNodes([...nodes, node])
  },

  removeNode(id: string) {
    const { nodes, edges, setNodes, setEdges } = useFlowStore.getState()
    setNodes(nodes.filter((n) => n.id !== id))
    setEdges(edges.filter((e) => e.source !== id && e.target !== id))
  },

  addEdge(edge: Edge) {
    const { edges, setEdges } = useFlowStore.getState()
    setEdges([...edges, edge])
  },
}
