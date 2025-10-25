"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "../../lib/supabaseClient";

export default function ResetPage() {
  const router = useRouter();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const DASHBOARD_PATH = "/docs/app.html"; // redirect after successful reset

  useEffect(() => {
    (async () => {
      // Check if we have a valid temporary session from Supabase recovery link
      const { data, error } = await supabaseClient.auth.getUser();
      if (error || !data?.user) {
        setMsg("The reset link is invalid or expired. Please request a new reset email.");
      }
      setLoading(false);
    })();
  }, []);

  const onSave = async () => {
    if (!pw1 || pw1.length < 8)
      return setMsg("Password must be at least 8 characters.");
    if (pw1 !== pw2)
      return setMsg("Passwords do not match.");

    const { error } = await supabaseClient.auth.updateUser({ password: pw1 });
    if (error) return setMsg(error.message);

    setMsg("✅ Password updated. Redirecting to your dashboard…");
    setTimeout(() => router.replace(DASHBOARD_PATH), 1000);
  };

  if (loading) {
    return (
      <main
        style={{
          fontFamily: "system-ui, Arial, sans-serif",
          maxWidth: 720,
          margin: "10vh auto",
          padding: "0 16px",
          textAlign: "center",
          color: "#555",
        }}
      >
        Checking reset link...
      </main>
    );
  }

  return (
    <main
      style={{
        fontFamily: "system-ui, Arial, sans-serif",
        maxWidth: 720,
        margin: "10vh auto",
        padding: "0 16px",
      }}
    >
      <div
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          padding: 22,
          boxShadow: "0 2px 6px rgba(0,0,0,.05)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Set a new password</h1>
        <p style={{ color: "#666", fontSize: 14, marginTop: 8 }}>
          Enter a new password for your account.
        </p>

        <input
          type="password"
          placeholder="New password (min 8 chars)"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          style={{ padding: 10, fontSize: 16, width: "100%" }}
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          style={{ padding: 10, fontSize: 16, width: "100%", marginTop: 8 }}
        />

        <button
          onClick={onSave}
          style={{
            padding: 10,
            fontSize: 16,
            width: "100%",
            marginTop: 8,
            cursor: "pointer",
          }}
        >
          Update password
        </button>

        <div style={{ color: "#666", fontSize: 14, marginTop: 8 }}>{msg}</div>
      </div>
    </main>
  );
}
