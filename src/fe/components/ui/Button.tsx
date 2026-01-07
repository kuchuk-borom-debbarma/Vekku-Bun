import React, { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

export const Button = ({ 
  children, 
  variant = "primary", 
  style, 
  ...props 
}: ButtonProps) => {
  const baseStyle: React.CSSProperties = {
    padding: "0.5rem 1rem",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    transition: "background-color 0.2s",
    ...style,
  };

  let variantStyle: React.CSSProperties = {};

  switch (variant) {
    case "primary":
      variantStyle = { background: "#007bff", color: "white" };
      break;
    case "secondary":
      variantStyle = { background: "#6c757d", color: "white" };
      break;
    case "danger":
      variantStyle = { background: "#dc3545", color: "white" };
      break;
    case "ghost":
      variantStyle = { background: "transparent", color: "#dc3545" };
      break;
  }

  return (
    <button style={{ ...baseStyle, ...variantStyle }} {...props}>
      {children}
    </button>
  );
};
