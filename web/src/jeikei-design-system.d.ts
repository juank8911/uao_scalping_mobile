declare module 'jeikei-design-system' {
  import type { ComponentType, Context } from 'react';

  export const NeoBadge: ComponentType<any>;
  export const NeoButton: ComponentType<any>;
  export const NeoCard: ComponentType<any>;
  export const NeoGrid: ComponentType<any>;
  export const NeoInput: ComponentType<any>;
  export const NeoLayout: ComponentType<any>;
  export const NeoModal: ComponentType<any>;
  export const NeoPanel: ComponentType<any>;
  export const NeoTable: ComponentType<any>;
  export const NeoTabs: ComponentType<any>;
  export const NeoToast: ComponentType<any>;
  export const NeuralBackground: ComponentType<any>;
  export const NeuralEngine: ComponentType<any>;
  export const SystemContext: Context<any>;
  export const SystemProvider: ComponentType<any>;
  export const V2: Record<string, unknown>;
  export const cx: (...inputs: any[]) => string;
  export const useSystem: (...args: any[]) => any;
}
