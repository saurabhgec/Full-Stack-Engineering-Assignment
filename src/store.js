// src/store.js
import { create } from "zustand";


const useStore = create((set) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  chatOpen: false,
  setNodes: (updater) => set((s) => ({ nodes: typeof updater === "function" ? updater(s.nodes) : updater })),
  setEdges: (updater) => set((s) => ({ edges: typeof updater === "function" ? updater(s.edges) : updater })),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setChatOpen: (val) => set({ chatOpen: val }),
}));

export default useStore;
