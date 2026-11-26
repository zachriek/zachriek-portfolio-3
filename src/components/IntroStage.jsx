import React, { useEffect } from "react";
import { FrameHeader } from "./FrameHeader.jsx";
import { identity } from "../config/portfolio.js";
import { mountGlimpse } from "../engines/glimpseEngine.js";

export function IntroStage() {
  useEffect(() => {
    const destroy = mountGlimpse({ tagline: identity.tagline });
    return () => {
      destroy?.();
    };
  }, []);

  return (
    <main className="stage">
      <FrameHeader />

      <h1 className="sr-only">
        {identity.domain} — {identity.tagline}
      </h1>
      <canvas className="wall" aria-hidden="true" />
      <div className="glass kb-glass" aria-hidden="true" />
      <canvas className="machine" aria-hidden="true" />
      <canvas className="tile" aria-hidden="true" />
      <p className="status" aria-hidden="true">
        <span className="mode">NORMAL</span>
        <span className="path" />
        <span className="pos" />
      </p>
      <p className="cmdline" aria-hidden="true">
        <span className="cmd" />
        <span className="showcmd" />
      </p>
      <p className="status pane-status" aria-hidden="true">
        <span className="mode">NORMAL</span>
        <span className="path" />
        <span className="pos" />
      </p>
      <p className="cmdline pane-cmd" aria-hidden="true">
        <span className="cmd" />
        <span className="showcmd" />
      </p>

      <a className="enter" href="/site/" aria-label="Enter">
        enter ↩
      </a>
      <button className="theme-key" type="button" aria-label="Change theme">
        <span className="command-glyph" aria-hidden="true" />
        :theme
      </button>
      <p className="note" aria-hidden="true">
        // {identity.tagline}
      </p>
      <nav className="sources sr-only" aria-label="Code shown on this page" />
    </main>
  );
}
