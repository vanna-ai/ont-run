import React, { useState } from "react";

interface JsonViewProps {
  data: unknown;
  depth?: number;
}

export function JsonView({ data, depth = 0 }: JsonViewProps) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  if (data === null) {
    return <span className="json-null">null</span>;
  }

  if (typeof data === "boolean") {
    return <span className="json-boolean">{String(data)}</span>;
  }

  if (typeof data === "number") {
    return <span className="json-number">{String(data)}</span>;
  }

  if (typeof data === "string") {
    return <span className="json-string">"{data}"</span>;
  }

  if (Array.isArray(data)) {
    if (collapsed) {
      return (
        <span
          className="json-collapsible json-collapsed"
          onClick={() => setCollapsed(false)}
        >
          [{data.length} items]
        </span>
      );
    }

    return (
      <span>
        <span
          className="json-collapsible json-expanded"
          onClick={() => setCollapsed(true)}
        >
          [
        </span>
        <div style={{ paddingLeft: "20px" }}>
          {data.map((item, i) => (
            <div key={i}>
              <JsonView data={item} depth={depth + 1} />
              {i < data.length - 1 ? "," : ""}
            </div>
          ))}
        </div>
        ]
      </span>
    );
  }

  if (typeof data === "object") {
    const keys = Object.keys(data);

    if (collapsed) {
      return (
        <span
          className="json-collapsible json-collapsed"
          onClick={() => setCollapsed(false)}
        >
          {"{" + keys.length + " keys}"}
        </span>
      );
    }

    return (
      <span>
        <span
          className="json-collapsible json-expanded"
          onClick={() => setCollapsed(true)}
        >
          {"{"}
        </span>
        <div style={{ paddingLeft: "20px" }}>
          {keys.map((key, i) => (
            <div key={key}>
              <span className="json-key">"{key}"</span>:{" "}
              <JsonView
                data={(data as Record<string, unknown>)[key]}
                depth={depth + 1}
              />
              {i < keys.length - 1 ? "," : ""}
            </div>
          ))}
        </div>
        {"}"}
      </span>
    );
  }

  return <span>{String(data)}</span>;
}
