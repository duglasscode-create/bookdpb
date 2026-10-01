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
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "var(--bg)" }}>
      <div className="t-card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl" style={{ background: "var(--accent-soft)" }}>
            🗂️
          </div>
          <h1 className="text-2xl font-bold">BookDPB</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Tus spaces en el iPad</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Correo electrónico</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="t-input" placeholder="tu@correo.com" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="t-input" placeholder="••••••••" />
          </div>
          {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
          <button type="submit" disabled={loading} className="t-btn t-btn-primary w-full">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
