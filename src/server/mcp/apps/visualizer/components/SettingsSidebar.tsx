/**
 * Settings Sidebar Component
 *
 * Collapsible sidebar for chart configuration with drag-and-drop Y-axis fields.
 */
import React, { useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";

type ChartType = "bar" | "line";

interface SettingsSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  xAxis: string;
  onXAxisChange: (field: string) => void;
  leftYAxes: string[];
  rightYAxes: string[];
  availableFields: string[];
  allFields: string[];
  numericFields: string[];
  onFieldMove: (field: string, target: "left" | "right" | "available") => void;
}

interface DraggableFieldProps {
  field: string;
  onDragStart: (e: React.DragEvent, field: string) => void;
}

function DraggableField({ field, onDragStart }: DraggableFieldProps) {
  return (
    <div
      className="draggable-field"
      draggable
      onDragStart={(e) => onDragStart(e, field)}
    >
      <GripVertical size={14} className="drag-handle" />
      <span>{field}</span>
    </div>
  );
}

interface DropZoneProps {
  title: string;
  fields: string[];
  targetId: "left" | "right" | "available";
  onDrop: (field: string, target: "left" | "right" | "available") => void;
  onDragStart: (e: React.DragEvent, field: string) => void;
}

function DropZone({ title, fields, targetId, onDrop, onDragStart }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const field = e.dataTransfer.getData("text/plain");
    if (field) {
      onDrop(field, targetId);
    }
  };

  return (
    <div className="drop-zone-wrapper">
      <label className="control-label">{title}</label>
      <div
        className={`drop-zone${isDragOver ? " drag-over" : ""}${fields.length === 0 ? " empty" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {fields.length === 0 ? (
          <span className="drop-hint">Drop fields here</span>
        ) : (
          fields.map((field) => (
            <DraggableField key={field} field={field} onDragStart={onDragStart} />
          ))
        )}
      </div>
    </div>
  );
}

export function SettingsSidebar({
  isOpen,
  onToggle,
  chartType,
  onChartTypeChange,
  xAxis,
  onXAxisChange,
  leftYAxes,
  rightYAxes,
  availableFields,
  allFields,
  numericFields,
  onFieldMove,
}: SettingsSidebarProps) {
  const handleDragStart = (e: React.DragEvent, field: string) => {
    e.dataTransfer.setData("text/plain", field);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFieldDrop = (field: string, target: "left" | "right" | "available") => {
    // Only allow numeric fields in Y-axis zones
    if ((target === "left" || target === "right") && !numericFields.includes(field)) {
      return;
    }
    onFieldMove(field, target);
  };

  if (!isOpen) {
    return (
      <div className="sidebar-collapsed">
        <button className="sidebar-toggle" onClick={onToggle} title="Open settings">
          <ChevronLeft size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="settings-sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Settings</span>
        <button className="sidebar-toggle" onClick={onToggle} title="Close settings">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="sidebar-content">
        {/* Chart Type */}
        <div className="control-group">
          <label className="control-label">Chart Type</label>
          <div className="chart-type-buttons">
            {(["bar", "line"] as const).map((type) => (
              <button
                key={type}
                className={`chart-type-btn${chartType === type ? " active" : ""}`}
                onClick={() => onChartTypeChange(type)}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* X-Axis */}
        <div className="control-group">
          <label className="control-label">X-Axis</label>
          <select
            className="control-select"
            value={xAxis}
            onChange={(e) => onXAxisChange(e.target.value)}
          >
            {allFields.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>

        {/* Left Y-Axis Drop Zone */}
        <DropZone
          title="Left Y-Axis"
          fields={leftYAxes}
          targetId="left"
          onDrop={handleFieldDrop}
          onDragStart={handleDragStart}
        />

        {/* Right Y-Axis Drop Zone */}
        <DropZone
          title="Right Y-Axis"
          fields={rightYAxes}
          targetId="right"
          onDrop={handleFieldDrop}
          onDragStart={handleDragStart}
        />

        {/* Available Fields */}
        <DropZone
          title="Available Fields"
          fields={availableFields}
          targetId="available"
          onDrop={handleFieldDrop}
          onDragStart={handleDragStart}
        />
      </div>
    </div>
  );
}
