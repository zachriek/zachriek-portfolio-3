import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/frame.css";
import "./styles/glimpse.css";
import { IntroPage } from "./pages/IntroPage.jsx";

createRoot(document.getElementById("root")).render(<IntroPage />);
