"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    // Confirm both password fields match before contacting the server.
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsPending(true);

    try {
      const { error } = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: "/dashboard",
      });

      if (error) {
        setError(error.message || "Unable to create your account.");
        return;
      }

      setMessage(
        "Account created! Check your terminal for the email verification link."
      );

      // Clear the form after successful registration.
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Full name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoComplete="name"
        />
      </div>

      <div>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword">Confirm password</label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      <button type="submit" disabled={isPending}>
        {isPending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}