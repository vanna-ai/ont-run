export interface GraphNode {
  id: string;
  label: string;
  type: 'function' | 'entity' | 'accessGroup';
  description: string;
  metadata?: {
    inputs?: any;
    outputs?: any;
    usesUserContext?: boolean;
    usesOrganizationContext?: boolean;
    isReadOnly?: boolean;
    [key: string]: any;
  };
  changeStatus?: 'unchanged' | 'added' | 'removed' | 'modified';
  changeDetails?: ChangeDetails;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'operates-on' | 'requires-access' | 'depends-on';
  label?: string;
}

export interface GraphMeta {
  ontologyName: string;
  hasChanges: boolean;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  totalNodes: number;
  totalFunctions: number;
  totalEntities: number;
  totalAccessGroups: number;
  totalUserContextFunctions: number;
  totalOrganizationContextFunctions: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: GraphMeta;
  diff?: any;
}

export interface ChangeDetails {
  oldAccess?: string[];
  newAccess?: string[];
  oldEntities?: string[];
  newEntities?: string[];
  oldDescription?: string;
  newDescription?: string;
  inputsChanged?: boolean;
  outputsChanged?: boolean;
  entitiesChanged?: boolean;
}

export interface NodeDetails {
  id: string;
  label: string;
  description: string;
  type: string;
  connections: {
    accessGroups: string[];
    entities: string[];
    dependsOn: Array<{ functionName: string; path: string }>;
    dependedOnBy: string[];
    functions: Array<{ name: string; description: string; outputs?: any }>;
  };
}

export interface SearchResult {
  id: string;
  label: string;
  type: string;
  matchType: string;
}

export interface TestConfig {
  environments?: string[];
  accessGroups?: string[];
}

export interface TestFieldSchema {
  name: string;
  required?: boolean;
  schema: any;
  fieldFrom?: string;
  isQueryBased?: boolean;
  isUserContext?: boolean;
  isOrganizationContext?: boolean;
  innerSchema?: any;
}

export interface TestFunctionSchema {
  name: string;
  description: string;
  schema: TestFieldSchema[];
}

export type ViewType = 'graph' | 'table' | 'source';
export type FilterType = 'all' | 'function' | 'entity' | 'accessGroup' | 'userContext' | 'organizationContext';
export type LayoutType = 'cose' | 'circle' | 'grid';
