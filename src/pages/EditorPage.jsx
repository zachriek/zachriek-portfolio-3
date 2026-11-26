import React, { useEffect, useRef } from "react";
import { PortfolioProvider, usePortfolio } from "../context/PortfolioContext.jsx";
import { FrameHeader } from "../components/FrameHeader.jsx";
import { EditorShell } from "../components/EditorShell.jsx";
import { StatusBar } from "../components/StatusBar.jsx";
import { identity } from "../config/portfolio.js";
import { mountEditor } from "../engines/editorEngine.js";

function EditorWorkspace() {
  const { data, drawerOpen, setDrawerOpen, wormOn, setWormOn } = usePortfolio();
  const stageRef = useRef(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!data || !stageRef.current) return undefined;
    const ctrl = mountEditor({
      root: stageRef.current,
      data,
      identity,
      initialWormOn: wormOn,
      onDrawerChange: (open) => setDrawerOpen(open),
    });
    controllerRef.current = ctrl;
    return () => {
      ctrl.destroy();
      controllerRef.current = null;
    };
  }, [data]);

  const handleToggleDrawer = () => {
    setDrawerOpen((prev) => {
      const next = !prev;
      controllerRef.current?.syncDrawer(next);
      return next;
    });
  };

  const handleToggleWorm = () => {
    const next = !wormOn;
    setWormOn(next);
    controllerRef.current?.setWorm(next);
  };

  return (
    <>
      <main className="stage" ref={stageRef}>
        <FrameHeader brandTip="back to the intro" />
        <h1 className="sr-only">{identity.domain} — experience, education, achievements, tools and themes.</h1>
        <EditorShell drawerOpen={drawerOpen} onToggleDrawer={handleToggleDrawer} />
        <StatusBar wormOn={wormOn} onToggleWorm={handleToggleWorm} />
        <div className="desk" aria-hidden="true" />
      </main>
      <canvas className="overlay" aria-hidden="true" />
    </>
  );
}

export function EditorPage() {
  return (
    <PortfolioProvider>
      <EditorWorkspace />
    </PortfolioProvider>
  );
}
