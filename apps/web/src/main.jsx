import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Admin from "./Admin.jsx";
import "./styles.css";

// Routage maison ultra simple basé sur le pathname
function Root() {
  const path = window.location.pathname;

  if (path.startsWith("/admin")) {
    return <Admin />;
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);