import React from "react";
import { BrandMark } from "./BrandMark.jsx";
import { identity, githubUrl } from "../config/portfolio.js";

export function FrameHeader({ brandTip }) {
  return (
    <header className="frame-top">
      <a className="brand" href="/" data-tip={brandTip || undefined}>
        <BrandMark />
        <span>{identity.domain}</span>
      </a>
      <nav className="switch is-solo" aria-label="Elsewhere">
        <a href={githubUrl} rel="me">
          github
        </a>
      </nav>
    </header>
  );
}
