"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else router.push("/dashboard");
    setLoading(false);
  };

  return (
    <div className="login-page">
      <img src="/icon-512.png" alt="BookDPB" className="login-logo" />
      <div className="login-card">
        <div className="login-head">
          <h1 className="login-title">BookDPB</h1>
          <p className="login-sub">Tus spaces en el iPad</p>
        </div>
        <form onSubmit={handleLogin}>
          <div className="login-field">
            <label className="login-label">Correo electrónico</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="login-input" placeholder="tu@correo.com" />
          </div>
          <div className="login-field">
            <label className="login-label">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="login-input" placeholder="••••••••" />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" disabled={loading} className="login-btn">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
