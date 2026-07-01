import React from "react";
import { createRoot } from "react-dom/client";
import { ArPage } from "../pages/ArPage.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ArPage mode="loc-ar" />
  </React.StrictMode>,
);
