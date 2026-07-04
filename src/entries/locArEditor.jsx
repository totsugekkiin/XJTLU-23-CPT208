import React from "react";
import { createRoot } from "react-dom/client";
import { ArEditorPage } from "../pages/ArEditorPage.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ArEditorPage />
  </React.StrictMode>,
);
