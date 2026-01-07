import React, { useState } from "react";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      alert("Login failed: " + ((err as any).response?.data?.message || (err as any).message));
    }
  };

  const handleTriggerVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/user/trigger-verification", { email });
      setVerificationToken(data.token);
      setRegStep("OTP");
    } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        alert("Verification failed: " + ((err as any).response?.data?.message || (err as any).message));
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        alert("Registration failed: " + ((err as any).response?.data?.message || (err as any).message));
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: "400px", margin: "0 auto", border: "1px solid #eee", padding: "2rem", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem", gap: "1rem" }}>
          <Button 
              variant={mode === "LOGIN" ? "primary" : "secondary"}
              onClick={() => setMode("LOGIN")}
          >
              Login
          </Button>
          <Button 
              variant={mode === "REGISTER" ? "primary" : "secondary"}
              onClick={() => setMode("REGISTER")}
          >
              Register
          </Button>
        </div>

        {mode === "LOGIN" ? (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h2 style={{ textAlign: "center", margin: 0 }}>Welcome Back</h2>
            <Input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
            <Input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
            <Button type="submit" style={{ marginTop: "1rem" }}>
              Login
            </Button>
          </form>
        ) : (
          <div>
            <h2 style={{ textAlign: "center", margin: "0 0 1rem 0" }}>Create Account</h2>
            {regStep === "EMAIL" ? (
              <form onSubmit={handleTriggerVerification} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <Input 
                  type="email" 
                  placeholder="Email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                />
                <Button type="submit" style={{ marginTop: "1rem" }}>
                  Send Verification OTP
                </Button>
              </form>
            ) : (
              <form onSubmit={handleCompleteRegistration} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p style={{ fontSize: "0.9rem", color: "#666", textAlign: "center" }}>
                    OTP sent to {email}<br/>(Use 123456 for demo)
                </p>
                <Input 
                  type="text" 
                  placeholder="OTP" 
                  value={otp} 
                  onChange={e => setOtp(e.target.value)} 
                  required 
                />
                <Input 
                  type="password" 
                  placeholder="Choose Password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                />
                <Button type="submit" style={{ marginTop: "1rem" }}>
                  Complete Registration
                </Button>
                <Button type="button" variant="ghost" onClick={() => setRegStep("EMAIL")}>
                  Back
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};