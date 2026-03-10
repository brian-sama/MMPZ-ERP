import { useState } from "react";
import { Navigate } from "react-router-dom";

export const LoginPage = ({ user, onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      const message = err?.response?.data?.error?.message || err?.response?.data?.detail || "Login failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-brand-50 via-slate-50 to-white px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-panel">
        <h1 className="text-2xl font-bold text-slate-900">Sign in to Intranet Portal</h1>
        <p className="mt-1 text-sm text-slate-600">Use your organization credentials.</p>
        <label className="mt-4 block text-sm font-medium text-slate-700">Email</label>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-200 focus:ring-2"
        />
        <label className="mt-4 block text-sm font-medium text-slate-700">Password</label>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-200 focus:ring-2"
        />
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
};
