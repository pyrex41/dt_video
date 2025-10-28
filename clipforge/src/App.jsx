import { useState } from "react";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");

  return (
    <div className="container">
      <h1>Welcome to ClipForge!</h1>
      <p>A Tauri-based video editor</p>
    </div>
  );
}

export default App;
