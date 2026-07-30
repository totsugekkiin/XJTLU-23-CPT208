import React from "react";
import { createRoot } from "react-dom/client";
import { MapPointEditorPage } from "../pages/MapPointEditorPage.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MapPointEditorPage />
  </React.StrictMode>,
);
