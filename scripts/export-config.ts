#!/usr/bin/env node
/**
 * Config Exporter for Go Backend
 * 
 * This script loads the TypeScript ontology config and exports it to JSON
 * so the Go backend can read it without needing to parse TypeScript.
 */

import { loadConfig } from '../src/cli/utils/config-loader.js';

async function exportConfig() {
  try {
    const { config } = await loadConfig();
    
    // Export simplified config for Go backend
    const exportedConfig = {
      name: config.name,
      functions: Object.entries(config.functions).reduce((acc, [name, fn]) => {
        acc[name] = {
          description: fn.description,
          access: fn.access,
          entities: fn.entities || [],
        };
        return acc;
      }, {} as Record<string, any>),
      accessGroups: Object.entries(config.accessGroups).reduce((acc, [name, group]) => {
        acc[name] = {
          description: group.description,
        };
        return acc;
      }, {} as Record<string, any>),
    };
    
    console.log(JSON.stringify(exportedConfig, null, 2));
  } catch (error) {
    console.error('Failed to export config:', error);
    process.exit(1);
  }
}

exportConfig();
