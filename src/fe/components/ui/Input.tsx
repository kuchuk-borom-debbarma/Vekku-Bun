import React, { type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = ({ label, style, ...props }: InputProps) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", width: "100%" }}>
      {label && <label style={{ fontSize: "0.9rem", fontWeight: 500 }}>{label}</label>}
      <input
        style={{
          padding: "0.5rem",
          borderRadius: "4px",
          border: "1px solid #ccc",
          fontSize: "1rem",
          ...style,
        }}
        {...props}
      />
    </div>
  );
};
