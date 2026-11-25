import { render } from "@solidjs/web";

// Placeholder entry for the private app. Spike PR 9 replaces it with the router, Access sign-in and data.
function App() {
  return <p>Private app placeholder</p>;
}

const mount = document.getElementById("app");
if (mount) render(() => <App />, mount);
