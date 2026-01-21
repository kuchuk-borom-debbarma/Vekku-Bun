import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "@/lib/api";

const Verify: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const hasVerified = useRef(false);
  
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (hasVerified.current) return;
    
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }

    hasVerified.current = true;

    const verify = async () => {
      try {
        await api.get(`/auth/signup/verify?token=${token}`);
        setStatus("success");
      } catch (err: any) {
        console.error(err);
        // Only set error if we aren't already successful (in case of race conditions, though ref handles most)
        setStatus("error");
        setMessage(err.response?.data?.error || "Verification failed. The token may be invalid or expired.");
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        {status === "verifying" && (
          <div className="space-y-4">
            <div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
            <h2 className="text-xl font-semibold text-gray-800">Verifying your account...</h2>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Account Verified!</h2>
            <p className="text-gray-600">Your account has been successfully created.</p>
            <Link
              to="/login"
              className="inline-block px-6 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              Go to Login
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-3xl">
              ✕
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Verification Failed</h2>
            <p className="text-gray-600">{message}</p>
            <Link
              to="/register"
              className="inline-block px-6 py-2 text-indigo-600 font-medium hover:text-indigo-800"
            >
              Try Registering Again
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Verify;
