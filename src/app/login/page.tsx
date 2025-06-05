// src/app/login/page.tsx
"use client";

import { useState, FormEvent, Suspense } from "react"; // Import Suspense
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./login.module.css";

// This component uses useSearchParams, so it needs to be inside Suspense
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams(); // This hook triggers the need for Suspense
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const handleSubmit = async (event: FormEvent) => {
    // ... (handleSubmit logic as before) ...
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        setError(
          result.error === "CredentialsSignin"
            ? "Invalid email or password."
            : result.error
        );
      } else if (result?.ok && !result?.error) {
        router.push(callbackUrl);
      } else {
        setError("An unknown error occurred. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.loginForm}>
      <h2>Login</h2>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.inputGroup}>
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
          autoComplete="email"
        />
      </div>
      <div className={styles.inputGroup}>
        <label htmlFor="password">Password</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
          autoComplete="current-password"
        />
      </div>
      <button type="submit" disabled={isLoading} className={styles.loginButton}>
        {isLoading ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className={styles.loginContainer}>
      <h1 className={styles.appTitle}>ERP Application Interface</h1>
      <Suspense
        fallback={<div className={styles.loadingForm}>Loading form...</div>}
      >
        <LoginContent />
      </Suspense>
    </div>
  );
}
