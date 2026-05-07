import React from "react";
import { createRoot } from "react-dom/client";
import { exposeGlobals } from "../shared/exposeGlobals.js";
import { AppMainPage } from "../pages/AppMainPage.jsx";

exposeGlobals();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppMainPage />
  </React.StrictMode>,
);

