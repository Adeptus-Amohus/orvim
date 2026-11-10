import React from "react";
import ReactDOM from "react-dom/client";
import StartupLoader from "./app/StartupLoader";
import "./styles/application.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("The application root element is missing.");
}

const application = ReactDOM.createRoot(root);
application.render(<StartupLoader />);
// Paint the small loading shell before parsing and mounting the workspace.
void import("./app/FullApp").then(
  ({ default: App }) =>
    application.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    ),
  () =>
    application.render(
      <div className="startup">
        <p>
          {navigator.language.startsWith("en")
            ? "Could not open Orvim."
            : "Не удалось открыть Orvim."}
        </p>
        <button onClick={() => location.reload()}>
          {navigator.language.startsWith("en") ? "Retry" : "Повторить"}
        </button>
      </div>,
    ),
);
