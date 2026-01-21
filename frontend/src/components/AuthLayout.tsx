import React from "react";
import { Outlet, Link } from "react-router-dom";

const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <Link to="/" className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center justify-center gap-2">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white">
            <span className="font-bold text-lg">V</span>
          </div>
          Vekku
        </Link>
        <p className="mt-2 text-zinc-500">Manage your digital knowledge base.</p>
      </div>
      
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <Outlet />
      </div>

      <div className="mt-8 text-center text-sm text-zinc-400">
        &copy; {new Date().getFullYear()} Vekku. All rights reserved.
      </div>
    </div>
  );
};

export default AuthLayout;
