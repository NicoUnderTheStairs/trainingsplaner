import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./App.scss";
import { AuthProvider } from "./auth/authContext/index.tsx";
import ErrorBoundary from "./ui/components/errorboundary/ErrorBoundary.tsx";
import { isCriticalError, logErrorToFirestore } from "./services/errorlog/errorLog.ts";

window.addEventListener("error", (e) => {
  if (e.message && isCriticalError(e.message)) {
    logErrorToFirestore(e.message, e.error?.stack);
  }
});

window.addEventListener("unhandledrejection", (e) => {
  const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "Unhandled rejection");
  if (isCriticalError(msg)) {
    logErrorToFirestore(msg, e.reason instanceof Error ? e.reason.stack : undefined);
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </AuthProvider>
  </StrictMode>,
);
