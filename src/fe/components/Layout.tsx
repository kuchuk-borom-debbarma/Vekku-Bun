import React from "react";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      {children}
    </div>
  );
};
