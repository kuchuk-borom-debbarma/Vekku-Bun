import React, { useState } from "react";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";

export const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"LOGIN" | "REGISTER">("LOGIN");
  
  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register State
  const [regStep, setRegStep] = useState<"EMAIL" | "OTP">("EMAIL");
  const [otp, setOtp] = useState("");
  const [verificationToken, setVerificationToken] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/user/login", { email, password });
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      navigate("/");
    } catch (err) {
      alert("Login failed: " + (err as any).response?.data?.message || (err as any).message);
    }
  };

  const handleTriggerVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/user/trigger-verification", { email });
      setVerificationToken(data.token);
      setRegStep("OTP");
    } catch (err) {
        alert("Verification failed: " + (err as any).response?.data?.message || (err as any).message);
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/user/verify-email", {
        token: verificationToken,
        otp,
        password,
      });
      alert("Registration successful! Please login.");
      setMode("LOGIN");
      setRegStep("EMAIL");
      setOtp("");
      setPassword("");
    } catch (err) {
        alert("Registration failed: " + (err as any).response?.data?.message || (err as any).message);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "2rem auto", padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
        <button 
            style={{ fontWeight: mode === "LOGIN" ? "bold" : "normal", marginRight: "1rem" }} 
            onClick={() => setMode("LOGIN")}
        >
            Login
        </button>
        <button 
            style={{ fontWeight: mode === "REGISTER" ? "bold" : "normal" }} 
            onClick={() => setMode("REGISTER")}
        >
            Register
        </button>
      </div>

      {mode === "LOGIN" ? (
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h2>Login</h2>
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
            style={{ padding: "0.5rem" }}
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            style={{ padding: "0.5rem" }}
          />
          <button type="submit" style={{ padding: "0.5rem", background: "blue", color: "white", border: "none" }}>
            Login
          </button>
        </form>
      ) : (
        <div>
          <h2>Register</h2>
          {regStep === "EMAIL" ? (
            <form onSubmit={handleTriggerVerification} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input 
                type="email" 
                placeholder="Email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                style={{ padding: "0.5rem" }}
              />
              <button type="submit" style={{ padding: "0.5rem", background: "green", color: "white", border: "none" }}>
                Send Verification OTP
              </button>
            </form>
          ) : (
            <form onSubmit={handleCompleteRegistration} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p>OTP sent to {email} (Use 123456 for demo)</p>
              <input 
                type="text" 
                placeholder="OTP" 
                value={otp} 
                onChange={e => setOtp(e.target.value)} 
                required 
                style={{ padding: "0.5rem" }}
              />
              <input 
                type="password" 
                placeholder="Choose Password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                style={{ padding: "0.5rem" }}
              />
              <button type="submit" style={{ padding: "0.5rem", background: "green", color: "white", border: "none" }}>
                Complete Registration
              </button>
              <button type="button" onClick={() => setRegStep("EMAIL")} style={{ marginTop: "0.5rem" }}>
                Back
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
