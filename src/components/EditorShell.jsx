import React from "react";

export function EditorShell({ drawerOpen, onToggleDrawer }) {
  return (
    <section
      className={drawerOpen ? "editor is-tree-open" : "editor"}
      aria-label="Editor"
    >
      <button
        className="tabline"
        type="button"
        aria-expanded={drawerOpen}
        aria-controls="tree"
        onClick={onToggleDrawer}
      >
        <span className="tab-dir">~/Portfolio</span>
        <span className="tab-file" />
        <span className="tab-toggle" aria-hidden="true">
          {drawerOpen ? "↑" : "↓"}
        </span>
      </button>
      <nav className="wheel" id="tree" aria-label="Portfolio sections and themes" />
      <div className="pane">
        <p className="winbar" />
        <div className="buffer" tabIndex={0} aria-live="polite" />
        <div className="eye-host" aria-hidden="true" />
      </div>
    </section>
  );
}
