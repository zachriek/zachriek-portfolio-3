import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/frame.css";
import "./styles/editor.css";
import { EditorPage } from "./pages/EditorPage.jsx";

createRoot(document.getElementById("root")).render(<EditorPage />);
