import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ThemeProvider } from "./theme/ThemeContext.jsx";
import { NotificationsProvider } from "./notifications/NotificationsContext.jsx";
import { ConfirmProvider } from "./component/ui/ConfirmProvider.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <ConfirmProvider>
        <NotificationsProvider>
          <App />
        </NotificationsProvider>
      </ConfirmProvider>
    </ThemeProvider>
  </StrictMode>,
);
