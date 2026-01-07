import React, { useState } from "react";

export const App = () => {
  const [count, setCount] = useState(0);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Vekku</h1>
      <p>Backend running on Bun + Hono</p>
      <p>Frontend running on React</p>
      
      <div style={{ marginTop: "1rem" }}>
        <button 
          onClick={() => setCount(c => c + 1)}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: "pointer"
          }}
        >
          Count is {count}
        </button>
      </div>
    </div>
  );
};
