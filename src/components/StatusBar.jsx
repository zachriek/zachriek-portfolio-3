import React from "react";
import { identity } from "../config/portfolio.js";

export function StatusBar({ wormOn, onToggleWorm }) {
  return (
    <div className="bar">
      <p className="bar-id" aria-hidden="true">
        <span className="bar-title">{identity.barTitle || identity.name.toUpperCase()}</span>
        <span className="bar-sub">
          <span className="cmd" />
          <span className="hunt" />
          <span className="keys" />
        </span>
      </p>
      <div className="bar-cols" aria-hidden="true" />
      <div className="bar-state" aria-hidden="true">
        <p className="col">
          <span className="label">WORM</span>
          <span className="value" data-k="worm">
            lurking
          </span>
        </p>
        <p className="col">
          <span className="label">EYE</span>
          <span className="value" data-k="eye">
            closed
          </span>
        </p>
        <p className="col">
          <span className="label">GHOST</span>
          <span className="value" data-k="ghost">
            idle
          </span>
        </p>
      </div>
      <button
        className="den"
        type="button"
        aria-label="worm"
        aria-pressed={wormOn}
        data-tip={wormOn ? "switch the worm off" : "wake the worm"}
        onClick={onToggleWorm}
      />
      <p className="bar-graph" aria-hidden="true">
        <span className="label span">VISITORS</span>
        <span className="value end" />
        <canvas />
      </p>
    </div>
  );
}
