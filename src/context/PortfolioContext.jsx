import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { wormStorageKey } from "../config/portfolio.js";

const PortfolioContext = createContext(null);

const loadJson = (url) =>
  fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json();
  });

export function PortfolioProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wormOn, setWormOn] = useState(() => {
    try {
      return localStorage.getItem(wormStorageKey) === "on";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    Promise.all([
      loadJson("/site/content.json"),
      loadJson("/themes.json"),
      loadJson("/site/stack.json").catch(() => null),
    ])
      .then(([content, themeData, stack]) => {
        if (!active) return;
        setData({ content, themeData, stack });
      })
      .catch((err) => {
        if (!active || controller.signal.aborted) return;
        setError(err);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const persistWorm = useCallback((next) => {
    setWormOn(next);
    try {
      if (next) localStorage.setItem(wormStorageKey, "on");
      else localStorage.removeItem(wormStorageKey);
    } catch {}
  }, []);

  return (
    <PortfolioContext.Provider
      value={{
        data,
        error,
        drawerOpen,
        setDrawerOpen,
        wormOn,
        setWormOn: persistWorm,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used inside PortfolioProvider");
  return ctx;
}
