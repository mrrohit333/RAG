"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, LogIn, UserPlus, Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://127.0.0.1:8000/login", {
        method: "POST",
        body: new URLSearchParams({ username, password }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Login failed");
      } else {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith("rag-chat-histories:") || k.startsWith("rag-current-chat-id:")) {
            localStorage.removeItem(k)
          }
        })
        localStorage.setItem("user_id", data.user_id);
        window.location.href = "/chat";
      }
    } catch (err) {
      setError("Network error");
    }
    setLoading(false);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://127.0.0.1:8000/register", {
        method: "POST",
        body: new URLSearchParams({ username, password }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Registration failed");
      } else {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith("rag-chat-histories:") || k.startsWith("rag-current-chat-id:")) {
            localStorage.removeItem(k)
          }
        })
        localStorage.setItem("user_id", data.user_id);
        window.location.href = "/chat";
      }
    } catch (err) {
      setError("Network error");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950 dark:via-teal-950 dark:to-cyan-950">
      {/* Animated background blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-fuchsia-400 to-purple-500 opacity-30 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 opacity-30 blur-3xl animate-[pulse_3s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 -right-16 h-64 w-64 rounded-full bg-gradient-to-br from-amber-300 to-rose-400 opacity-20 blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />

      <Card className="w-full max-w-md p-6 shadow-2xl bg-white/80 dark:bg-gray-900/70 border border-emerald-200/60 dark:border-emerald-800/60 backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-fuchsia-500 to-purple-700 flex items-center justify-center text-white shadow-xl animate-in fade-in-0 slide-in-from-top-2">
            <Bot className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Welcome to RAG Assistant
          </h1>
          <p className="text-xs text-muted-foreground">Login or create an account to continue</p>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur">
            <TabsTrigger value="login" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <LogIn className="w-4 h-4" /> Login
            </TabsTrigger>
            <TabsTrigger value="register" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white">
              <UserPlus className="w-4 h-4" /> Register
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-6 animate-in fade-in-0 slide-in-from-top-2">
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="pl-9 bg-white/80 dark:bg-gray-800/80"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-9 pr-10 bg-white/80 dark:bg-gray-800/80"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button type="submit" disabled={loading} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg">
                {loading ? "Logging in..." : "Login"}
              </Button>
              {error && <div className="text-red-600 text-sm">{error}</div>}
            </form>
          </TabsContent>

          <TabsContent value="register" className="mt-6 animate-in fade-in-0 slide-in-from-top-2">
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="pl-9 bg-white/80 dark:bg-gray-800/80"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-9 pr-10 bg-white/80 dark:bg-gray-800/80"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button type="submit" disabled={loading} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg">
                {loading ? "Registering..." : "Register"}
              </Button>
              {error && <div className="text-red-600 text-sm">{error}</div>}
            </form>
          </TabsContent>
        </Tabs>
      </Card>

      <div className="mt-8 px-6 max-w-2xl text-center animate-in fade-in-0 slide-in-from-bottom-2">
        <h2 className="text-sm font-semibold tracking-wide bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
          About RAG Assistant
        </h2>
        <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
          <p>
            RAG Assistant is a document-aware chatbot. Upload your files and chat with them securely.
            We index your documents locally and generate grounded answers using retrieval‑augmented generation.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left">
            <li className="rounded-md border border-emerald-200/60 dark:border-emerald-800/60 px-3 py-2 bg-white/60 dark:bg-gray-800/60">
              <span className="font-medium text-foreground">Formats</span>
              <div>PDF, TXT, CSV, TSV, XLSX, DOCX, PPTX</div>
            </li>
            <li className="rounded-md border border-emerald-200/60 dark:border-emerald-800/60 px-3 py-2 bg-white/60 dark:bg-gray-800/60">
              <span className="font-medium text-foreground">Private by design</span>
              <div>Per‑user storage and vector indices</div>
            </li>
            <li className="rounded-md border border-emerald-200/60 dark:border-emerald-800/60 px-3 py-2 bg-white/60 dark:bg-gray-800/60">
              <span className="font-medium text-foreground">Tech</span>
              <div>FastAPI · FAISS · Sentence‑Transformers · Next.js</div>
            </li>
          </ul>
          <p className="opacity-80">Developed by RRRS</p>
        </div>
      </div>
    </div>
  );
}