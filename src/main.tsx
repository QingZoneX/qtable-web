import React from "react";
import ReactDOM from "react-dom/client";
import "antd/dist/reset.css";
import App from "./App.tsx";
import "./index.css";
import { ApolloProvider } from "@apollo/client/react";
import { client } from "./lib/apollo";
import { installQTableCssVariables } from "./styles/tokens";
import { ensureVisActorBrowserEnv } from "./lib/visactorEnv";

installQTableCssVariables();

// Bind VRender's browser env before any table/chart is created so the first
// grid render cannot race the table scroll bar's `addEventListener` call.
ensureVisActorBrowserEnv();

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.info("[SW] Registration successful, scope is:", registration.scope);
        })
        .catch((error: unknown) => {
          console.warn("[SW] Registration failed:", error);
        });
    });
  } else {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        void registration.unregister();
      }
    });
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>,
);
