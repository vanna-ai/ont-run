import React, { useState, useEffect } from 'react';
import type { TestConfig, TestFieldSchema, TestFunctionSchema } from '../types';
import { formatFieldName, getTypeHint, getDefaultValueForType, generateDefaultFromSchema } from '../utils/formatting';

// Minimum query length to trigger search dropdown options
const MIN_SEARCH_QUERY_LENGTH_FOR_DROPDOWN = 2;

interface TestModalProps {
  isOpen: boolean;
  functionName: string | null;
  testConfig: TestConfig | null;
  onClose: () => void;
}

export const TestModal: React.FC<TestModalProps> = ({ isOpen, functionName, testConfig, onClose }) => {
  const [schema, setSchema] = useState<TestFunctionSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [executing, setExecuting] = useState(false);
  const [resultView, setResultView] = useState<'table' | 'json'>('table');
  const [formData, setFormData] = useState<any>({});
  const [env, setEnv] = useState('dev');
  const [accessGroups, setAccessGroups] = useState<string[]>([]);
  const [fieldOptions, setFieldOptions] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (testConfig?.accessGroups) {
      setAccessGroups(testConfig.accessGroups);
    }
  }, [testConfig]);

  useEffect(() => {
    if (!isOpen || !functionName) {
      setSchema(null);
      setTestResults(null);
      setFormData({});
      setFieldOptions({});
      return;
    }

    const loadSchema = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/function/${functionName}/schema`);
        const data = await res.json();
        if (data.error) {
          throw new Error(data.error);
        }
        setSchema(data);
        
        // Initialize form data with defaults for user context
        const initialData: any = {};
        data.schema.forEach((field: TestFieldSchema) => {
          if (field.isUserContext && field.innerSchema) {
            initialData[field.name] = generateDefaultFromSchema(field.innerSchema);
          }
        });
        setFormData(initialData);
      } catch (err) {
        console.error('Failed to load schema:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSchema();
  }, [isOpen, functionName]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleExecute = async () => {
    if (!schema) return;
    
    setExecuting(true);
    try {
      const inputs: any = {};
      const mockUserContext: any = {};
      
      schema.schema.forEach((field: TestFieldSchema) => {
        const value = formData[field.name];
        if (value !== undefined && value !== '') {
          if (field.isUserContext || field.isOrganizationContext) {
            mockUserContext[field.name] = value;
          } else {
            inputs[field.name] = value;
          }
        }
      });

      const res = await fetch(`/api/test/${functionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env, accessGroups, mockUserContext, inputs }),
      });
      const result = await res.json();
      setTestResults(result);
      setResultView('table');
    } catch (err) {
      setTestResults({
        success: false,
        error: (err as Error).message,
      });
    } finally {
      setExecuting(false);
    }
  };

  const loadFieldOptions = async (fieldName: string, sourceFunctionName: string) => {
    try {
      const res = await fetch(`/api/function/${sourceFunctionName}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env, accessGroups }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFieldOptions(prev => ({ ...prev, [fieldName]: data.options || [] }));
    } catch (err) {
      console.error('Failed to load options:', err);
    }
  };

  const searchFieldOptions = async (fieldName: string, sourceFunctionName: string, query: string) => {
    if (query.length < MIN_SEARCH_QUERY_LENGTH_FOR_DROPDOWN) {
      setFieldOptions(prev => ({ ...prev, [fieldName]: [] }));
      return;
    }
    
    try {
      const res = await fetch(`/api/function/${sourceFunctionName}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env, accessGroups, query }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFieldOptions(prev => ({ ...prev, [fieldName]: data.options || [] }));
    } catch (err) {
      console.error('Failed to search options:', err);
    }
  };

  return (
    <div className="test-modal-backdrop visible" onClick={handleBackdropClick}>
      <div className="test-modal">
        <div className="test-modal-header">
          <div className="test-modal-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Test: {functionName}</span>
            <span className="test-mode-badge">Test Mode</span>
          </div>
          <button className="test-modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="test-modal-body">
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Loading...
            </div>
          )}
          {!loading && schema && (
            <>
              {schema.description && (
                <p className="test-modal-description">{schema.description}</p>
              )}
              
              {/* Test Context Section */}
              <div className="test-context-section">
                <div className="test-context-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                  <span className="test-context-title">Test Context</span>
                </div>
                <div className="test-form-group">
                  <label className="test-form-label">Environment</label>
                  <select 
                    className="test-form-select" 
                    value={env}
                    onChange={(e) => setEnv(e.target.value)}
                  >
                    {(testConfig?.environments || ['dev']).map(e => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
                <div className="test-form-group">
                  <label className="test-form-label">Access Groups</label>
                  <div className="access-groups-grid">
                    {(testConfig?.accessGroups || []).map(g => (
                      <label key={g} className={`access-group-checkbox ${accessGroups.includes(g) ? 'checked' : ''}`}>
                        <input 
                          type="checkbox" 
                          name="accessGroup" 
                          value={g}
                          checked={accessGroups.includes(g)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAccessGroups(prev => [...prev, g]);
                            } else {
                              setAccessGroups(prev => prev.filter(ag => ag !== g));
                            }
                          }}
                        />
                        <span>{g}</span>
                      </label>
                    ))}
                    {(!testConfig?.accessGroups || testConfig.accessGroups.length === 0) && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No access groups defined</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Function Inputs */}
              <TestFields 
                schema={schema}
                formData={formData}
                setFormData={setFormData}
                fieldOptions={fieldOptions}
                loadFieldOptions={loadFieldOptions}
                searchFieldOptions={searchFieldOptions}
              />

              {/* Execute Button */}
              <button 
                className={`test-execute-btn ${executing ? 'loading' : ''}`}
                onClick={handleExecute}
                disabled={executing}
              >
                {executing ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    Executing...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Execute Function
                  </>
                )}
              </button>

              {/* Test Results */}
              {testResults && (
                <TestResults 
                  results={testResults}
                  resultView={resultView}
                  onViewChange={setResultView}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Test Fields Component
const TestFields: React.FC<{
  schema: TestFunctionSchema;
  formData: any;
  setFormData: (data: any) => void;
  fieldOptions: Record<string, any[]>;
  loadFieldOptions: (fieldName: string, sourceFunctionName: string) => void;
  searchFieldOptions: (fieldName: string, sourceFunctionName: string, query: string) => void;
}> = ({ schema, formData, setFormData, fieldOptions, loadFieldOptions, searchFieldOptions }) => {
  const regularFields = schema.schema.filter(f => !f.isUserContext && !f.isOrganizationContext && !f.fieldFrom);
  const fieldFromFields = schema.schema.filter(f => f.fieldFrom);
  const userContextFields = schema.schema.filter(f => f.isUserContext);
  const orgContextFields = schema.schema.filter(f => f.isOrganizationContext);

  const updateField = (name: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  return (
    <>
      {(regularFields.length > 0 || fieldFromFields.length > 0) && (
        <div className="test-form-section">
          <div className="test-form-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            Function Inputs
          </div>
          {regularFields.map(field => (
            <FormField 
              key={field.name}
              field={field}
              value={formData[field.name]}
              onChange={(value) => updateField(field.name, value)}
            />
          ))}
          {fieldFromFields.map(field => (
            <FieldFromField
              key={field.name}
              field={field}
              value={formData[field.name]}
              onChange={(value) => updateField(field.name, value)}
              options={fieldOptions[field.name] || []}
              onLoadOptions={loadFieldOptions}
              onSearchOptions={searchFieldOptions}
            />
          ))}
        </div>
      )}

      {userContextFields.length > 0 && (
        <UserContextSection
          fields={userContextFields}
          formData={formData}
          setFormData={setFormData}
          title="Mock User Context"
        />
      )}

      {orgContextFields.length > 0 && (
        <UserContextSection
          fields={orgContextFields}
          formData={formData}
          setFormData={setFormData}
          title="Mock Organization Context"
        />
      )}
    </>
  );
};

// Individual Form Field
const FormField: React.FC<{
  field: TestFieldSchema;
  value: any;
  onChange: (value: any) => void;
}> = ({ field, value, onChange }) => {
  const inputId = `test-input-${field.name}`;
  const displayName = formatFieldName(field.name);
  const typeHint = getTypeHint(field.schema);

  if (field.schema.type === 'boolean') {
    return (
      <div className="test-form-group">
        <div className="test-form-checkbox">
          <input 
            type="checkbox" 
            id={inputId}
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
          />
          <label htmlFor={inputId}>{displayName}</label>
        </div>
      </div>
    );
  }

  if (field.schema.enum) {
    return (
      <div className="test-form-group">
        <label className="test-form-label" htmlFor={inputId}>
          {displayName} {field.required && <span className="required">*</span>}
        </label>
        <select 
          className="test-form-select" 
          id={inputId}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select an option...</option>
          {field.schema.enum.map((v: string) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.schema.type === 'number' || field.schema.type === 'integer') {
    return (
      <div className="test-form-group">
        <label className="test-form-label" htmlFor={inputId}>
          {displayName} {field.required && <span className="required">*</span>}
        </label>
        <input
          type="number"
          step={field.schema.type === 'integer' ? '1' : 'any'}
          className="test-form-input"
          id={inputId}
          value={value || ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          placeholder={`Enter a ${field.schema.type}...`}
        />
        {typeHint && <div className="test-form-hint">{typeHint}</div>}
      </div>
    );
  }

  if (field.schema.type === 'object' || field.schema.type === 'array') {
    return (
      <div className="test-form-group">
        <label className="test-form-label" htmlFor={inputId}>
          {displayName} {field.required && <span className="required">*</span>}
        </label>
        <textarea
          className="test-form-textarea"
          id={inputId}
          value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
          placeholder={field.schema.type === 'array' ? '[]' : '{}'}
        />
        {typeHint && <div className="test-form-hint">{typeHint}</div>}
      </div>
    );
  }

  const inputType = field.schema.format === 'email' ? 'email' : 'text';
  const placeholder = field.schema.format === 'email' ? 'user@example.com' : `Enter ${displayName.toLowerCase()}...`;

  return (
    <div className="test-form-group">
      <label className="test-form-label" htmlFor={inputId}>
        {displayName} {field.required && <span className="required">*</span>}
      </label>
      <input
        type={inputType}
        className="test-form-input"
        id={inputId}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {typeHint && <div className="test-form-hint">{typeHint}</div>}
    </div>
  );
};

// FieldFrom Field (dropdown with options from another function)
const FieldFromField: React.FC<{
  field: TestFieldSchema;
  value: any;
  onChange: (value: any) => void;
  options: any[];
  onLoadOptions: (fieldName: string, sourceFunctionName: string) => void;
  onSearchOptions: (fieldName: string, sourceFunctionName: string, query: string) => void;
}> = ({ field, value, onChange, options, onLoadOptions, onSearchOptions }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const inputId = `test-input-${field.name}`;
  const displayName = formatFieldName(field.name);

  if (field.isQueryBased) {
    return (
      <div className="test-form-group fieldFrom-field">
        <label className="test-form-label" htmlFor={`${inputId}-search`}>
          {displayName} {field.required && <span className="required">*</span>}
          <span className="fieldFrom-hint">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            {field.fieldFrom}
          </span>
        </label>
        <input
          type="text"
          className="test-form-input"
          id={`${inputId}-search`}
          placeholder="Type to search..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            onSearchOptions(field.name, field.fieldFrom!, e.target.value);
          }}
        />
        <select
          className="test-form-select"
          id={inputId}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ marginTop: '8px' }}
        >
          <option value="">{options.length > 0 ? 'Select...' : 'Type above to search...'}</option>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="test-form-hint">Search-based selection from {field.fieldFrom}</div>
      </div>
    );
  }

  return (
    <div className="test-form-group fieldFrom-field">
      <label className="test-form-label" htmlFor={inputId}>
        {displayName} {field.required && <span className="required">*</span>}
        <span className="fieldFrom-hint">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {field.fieldFrom}
        </span>
      </label>
      <select
        className="test-form-select"
        id={inputId}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={options.length === 0}
      >
        <option value="">{options.length > 0 ? 'Select...' : 'Click "Load Options" to populate'}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button 
        type="button" 
        className="load-options-btn"
        onClick={() => onLoadOptions(field.name, field.fieldFrom!)}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Load Options
      </button>
      <div className="test-form-hint">Options loaded from {field.fieldFrom}</div>
    </div>
  );
};

// User/Org Context Section
const UserContextSection: React.FC<{
  fields: TestFieldSchema[];
  formData: any;
  setFormData: (data: any) => void;
  title: string;
}> = ({ fields, formData, setFormData, title }) => {
  return (
    <div className="user-context-section">
      <div className="user-context-header">
        <div className="user-context-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {title}
        </div>
        <span className="mock-badge">Test Only</span>
      </div>
      {fields.map(field => {
        if (field.innerSchema && field.innerSchema.type === 'object' && field.innerSchema.properties) {
          return (
            <div key={field.name} style={{ marginBottom: '12px' }}>
              <div className="test-form-label" style={{ marginBottom: '8px' }}>
                {formatFieldName(field.name)}
              </div>
              <div style={{ paddingLeft: '12px', borderLeft: '2px solid rgba(254, 93, 38, 0.3)' }}>
                {Object.entries(field.innerSchema.properties).map(([key, prop]: [string, any]) => {
                  const subInputId = `${field.name}-${key}`;
                  const subDisplayName = formatFieldName(key);
                  // Use existing value or compute default only if needed (short-circuits if value exists)
                  const currentValue = formData[field.name]?.[key] ?? getDefaultValueForType(prop, key);

                  const updateSubField = (value: any) => {
                    setFormData((prev: any) => ({
                      ...prev,
                      [field.name]: {
                        ...(prev[field.name] || {}),
                        [key]: value
                      }
                    }));
                  };

                  if (prop.type === 'boolean') {
                    return (
                      <div key={key} className="test-form-group" style={{ marginBottom: '12px' }}>
                        <div className="test-form-checkbox">
                          <input 
                            type="checkbox" 
                            id={subInputId}
                            checked={currentValue || false}
                            onChange={(e) => updateSubField(e.target.checked)}
                          />
                          <label htmlFor={subInputId}>{subDisplayName}</label>
                        </div>
                      </div>
                    );
                  }

                  if (prop.type === 'number' || prop.type === 'integer') {
                    return (
                      <div key={key} className="test-form-group" style={{ marginBottom: '12px' }}>
                        <label className="test-form-label" htmlFor={subInputId}>{subDisplayName}</label>
                        <input
                          type="number"
                          className="test-form-input"
                          id={subInputId}
                          value={currentValue || ''}
                          onChange={(e) => updateSubField(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder={`Enter ${subDisplayName.toLowerCase()}...`}
                        />
                      </div>
                    );
                  }

                  const inputType = prop.format === 'email' ? 'email' : 'text';
                  const placeholder = prop.format === 'email' ? 'user@example.com' : `Enter ${subDisplayName.toLowerCase()}...`;

                  return (
                    <div key={key} className="test-form-group" style={{ marginBottom: '12px' }}>
                      <label className="test-form-label" htmlFor={subInputId}>{subDisplayName}</label>
                      <input
                        type={inputType}
                        className="test-form-input"
                        id={subInputId}
                        value={currentValue || ''}
                        onChange={(e) => updateSubField(e.target.value)}
                        placeholder={placeholder}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        return (
          <div key={field.name} className="test-form-group">
            <label className="test-form-label" htmlFor={`test-input-${field.name}`}>
              {formatFieldName(field.name)}
            </label>
            <textarea
              className="test-form-textarea"
              id={`test-input-${field.name}`}
              value={JSON.stringify(formData[field.name] || generateDefaultFromSchema(field.innerSchema), null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setFormData((prev: any) => ({ ...prev, [field.name]: parsed }));
                } catch {
                  // Invalid JSON, ignore
                }
              }}
            />
            <div className="test-form-hint">JSON object for context simulation</div>
          </div>
        );
      })}
    </div>
  );
};

// Test Results Component
const TestResults: React.FC<{
  results: any;
  resultView: 'table' | 'json';
  onViewChange: (view: 'table' | 'json') => void;
}> = ({ results, resultView, onViewChange }) => {
  if (!results) return null;

  if (results.success) {
    const isArray = Array.isArray(results.result);
    const isObject = results.result && typeof results.result === 'object' && !isArray;
    const isPrimitive = !isArray && !isObject;

    return (
      <div className="test-result success">
        <div className="test-result-header success">
          <span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Success
          </span>
        </div>
        <div className="test-result-meta">
          <span className="test-result-time">{results.executionTime}ms</span>
          {isArray && <span className="test-result-count">{results.result.length} item{results.result.length !== 1 ? 's' : ''}</span>}
          {!isPrimitive && (
            <div className="test-result-view-toggle">
              <button 
                className={resultView === 'table' ? 'active' : ''}
                onClick={() => onViewChange('table')}
              >
                {isArray ? 'Table' : 'Details'}
              </button>
              <button 
                className={resultView === 'json' ? 'active' : ''}
                onClick={() => onViewChange('json')}
              >
                JSON
              </button>
            </div>
          )}
        </div>
        <div className="test-result-content">
          {resultView === 'json' || isPrimitive ? (
            <pre>{typeof results.result === 'string' ? results.result : JSON.stringify(results.result, null, 2)}</pre>
          ) : isArray && results.result.length > 0 && typeof results.result[0] === 'object' ? (
            <ResultTable data={results.result} />
          ) : isObject ? (
            <ResultKeyValue data={results.result} />
          ) : (
            <pre>{String(results.result)}</pre>
          )}
        </div>
      </div>
    );
  }

  if (results.validationErrors) {
    return (
      <div className="test-result error">
        <div className="test-result-header error">
          <span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            Validation Failed
          </span>
        </div>
        <ul className="test-validation-errors">
          {results.validationErrors.map((e: any, i: number) => (
            <li key={i}>
              <svg className="test-validation-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <span className="test-validation-path">{e.path || 'root'}</span>
                <span className="test-validation-message">{e.message}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="test-result error">
      <div className="test-result-header error">
        <span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          Error
        </span>
      </div>
      <div className="test-result-content" style={{ color: '#c44536' }}>
        {results.error || 'Unknown error'}
      </div>
      {results.stack && (
        <div className="test-error-stack">
          <details>
            <summary>Show Stack Trace</summary>
            <pre>{results.stack}</pre>
          </details>
        </div>
      )}
    </div>
  );
};

// Result Table
const ResultTable: React.FC<{ data: any[] }> = ({ data }) => {
  if (!Array.isArray(data) || data.length === 0) return <pre>[]</pre>;

  const allKeys = new Set<string>();
  data.forEach(item => {
    if (item && typeof item === 'object') {
      Object.keys(item).forEach(key => allKeys.add(key));
    }
  });
  const keys = Array.from(allKeys);

  if (keys.length === 0) return <pre>{JSON.stringify(data, null, 2)}</pre>;

  return (
    <table className="test-results-table">
      <thead>
        <tr>
          {keys.map(key => (
            <th key={key}>{formatFieldName(key)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item, i) => (
          <tr key={i}>
            {keys.map(key => {
              const value = item ? item[key] : undefined;
              return <ResultCell key={key} value={value} />;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const ResultCell: React.FC<{ value: any }> = ({ value }) => {
  if (value === null || value === undefined) {
    return <td className="cell-null">-</td>;
  }
  if (typeof value === 'boolean') {
    return <td className={`cell-boolean ${value}`}>{value ? '✓' : '✗'}</td>;
  }
  if (typeof value === 'number') {
    return <td className="cell-number">{value}</td>;
  }
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    const display = str.length > 50 ? str.substring(0, 47) + '...' : str;
    return <td className="cell-object" title={str}>{display}</td>;
  }
  return <td>{String(value)}</td>;
};

// Result Key-Value
const ResultKeyValue: React.FC<{ data: any }> = ({ data }) => {
  if (!data || typeof data !== 'object') {
    return <pre>{String(data)}</pre>;
  }

  return (
    <dl className="test-results-kv">
      {Object.entries(data).map(([key, value]) => {
        const displayKey = formatFieldName(key);
        let valueClass = '';
        let displayValue = '';

        if (value === null || value === undefined) {
          valueClass = 'value-null';
          displayValue = 'null';
        } else if (typeof value === 'boolean') {
          valueClass = 'value-boolean';
          displayValue = value ? '✓ true' : '✗ false';
        } else if (typeof value === 'number') {
          valueClass = 'value-number';
          displayValue = String(value);
        } else if (typeof value === 'object') {
          displayValue = JSON.stringify(value, null, 2);
        } else {
          displayValue = String(value);
        }

        return (
          <React.Fragment key={key}>
            <dt>{displayKey}</dt>
            <dd className={valueClass}>{displayValue}</dd>
          </React.Fragment>
        );
      })}
    </dl>
  );
};
