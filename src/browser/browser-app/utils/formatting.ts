export function escapeHtml(text: string | undefined): string {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatType(type: string): string {
  const labels: Record<string, string> = {
    function: 'Function',
    entity: 'Entity',
    accessGroup: 'Access Group',
  };
  return labels[type] || type;
}

export function formatSchema(schema: any): string {
  if (!schema) return 'No schema';

  if (schema.type === 'object' && schema.properties) {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(schema.properties)) {
      const required = schema.required?.includes(key) ? '' : '?';
      const type = formatSchemaType(value);
      lines.push(`  ${key}${required}: ${type}`);
    }
    return '{\n' + lines.join(',\n') + '\n}';
  }

  return JSON.stringify(schema, null, 2);
}

export function formatSchemaType(schema: any): string {
  if (!schema) return 'unknown';
  if (schema.type === 'array') {
    return `${formatSchemaType(schema.items)}[]`;
  }
  if (schema.type === 'object') {
    return 'object';
  }
  if (schema.enum) {
    return schema.enum.map((e: string) => `"${e}"`).join(' | ');
  }
  // Handle union/intersection schemas
  if (schema.anyOf) {
    return schema.anyOf.map(formatSchemaType).join(' | ');
  }
  if (schema.oneOf) {
    return schema.oneOf.map(formatSchemaType).join(' | ');
  }
  if (schema.allOf) {
    return schema.allOf.map(formatSchemaType).join(' & ');
  }
  let type = schema.type || 'unknown';
  if (schema.format) {
    type += ` (${schema.format})`;
  }
  return type;
}

export function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

export function getTypeHint(schema: any): string {
  if (schema.enum) return `One of: ${schema.enum.join(', ')}`;
  if (schema.type === 'number' || schema.type === 'integer') {
    let hint = schema.type === 'integer' ? 'Integer' : 'Number';
    if (schema.minimum !== undefined) hint += `, min: ${schema.minimum}`;
    if (schema.maximum !== undefined) hint += `, max: ${schema.maximum}`;
    return hint;
  }
  if (schema.type === 'string') {
    if (schema.format === 'email') return 'Email address';
    if (schema.format === 'date') return 'Date (YYYY-MM-DD)';
    if (schema.format === 'date-time') return 'Date and time';
    if (schema.minLength || schema.maxLength) {
      const parts = [];
      if (schema.minLength) parts.push(`min ${schema.minLength}`);
      if (schema.maxLength) parts.push(`max ${schema.maxLength}`);
      return `String (${parts.join(', ')} chars)`;
    }
    return 'Text';
  }
  if (schema.type === 'array') return 'Array (JSON format)';
  if (schema.type === 'object') return 'Object (JSON format)';
  return '';
}

export function highlightTypeScript(code: string): string {
  // Escape HTML first
  code = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Comments (single and multi-line)
  code = code.replace(/(\/\/.*$)/gm, '<span class="comment">$1</span>');
  code = code.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$1</span>');

  // Strings (double, single, and template)
  code = code.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="string">$1</span>');
  code = code.replace(/('(?:[^'\\]|\\.)*')/g, '<span class="string">$1</span>');
  code = code.replace(/(`(?:[^`\\]|\\.)*`)/g, '<span class="string">$1</span>');

  // Keywords
  const keywords = ['import', 'export', 'from', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'this', 'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'async', 'await', 'default', 'as', 'type', 'interface'];
  keywords.forEach(kw => {
    code = code.replace(new RegExp('\\b(' + kw + ')\\b', 'g'), '<span class="keyword">$1</span>');
  });

  // Numbers
  code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>');

  // Function calls
  code = code.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, '<span class="function">$1</span>(');

  return code;
}

function getDefaultForPropertyType(type: string, format?: string, propertyName?: string): any {
  if (type === 'string') {
    if (format === 'email') return 'test@example.com';
    return propertyName ? `test-${propertyName}` : 'test-value';
  }
  if (type === 'number' || type === 'integer') {
    return 1;
  }
  if (type === 'boolean') {
    return false;
  }
  return '';
}

export function getDefaultValueForType(prop: any, propertyName?: string): any {
  return getDefaultForPropertyType(prop.type, prop.format, propertyName);
}

export function generateDefaultFromSchema(schema: any): any {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return {};
  }
  const result: any = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    const propSchema = prop as any;
    result[key] = getDefaultForPropertyType(propSchema.type, propSchema.format, key);
  }
  return result;
}
