// app/finder/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseClient } from "../../lib/supabaseClient"; // ✅ matches your export name

type Row = {
  program_id: string;
  university_name: string | null;
  name: string | null;
  track: string | null;
  gre_required: string | null; // "required" | "optional" | "waived" | null
  gre_min_total: number | null;
  english_tests_accepted: string | null;
  toefl_min_total: number | null;
  tuition_usd_per_year: number | null;
  program_url: string | null;
  website_url: string | null;
  stem: string | null; // "Y" or "N"
  opt_months: number | null;
};

export default function FinderPage() {
  const [gre, setGre] = useState<string>("");
  const [toefl, setToefl] = useState<string>("");
  const [track, setTrack] = useState<string>("");
  const [onlyGreOptional, setOnlyGreOptional] = useState<boolean>(false);

  const [status, setStatus] = useState<string>("Ready.");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  async function search() {
    setLoading(true);
    setStatus("Searching…");
    setRows([]);

    // Base query
    let query = supabaseClient
      .from("programs_view")
      .select(
        "program_id, university_name, name, track, gre_required, gre_min_total, english_tests_accepted, toefl_min_total, tuition_usd_per_year, program_url, website_url, stem, opt_months"
      )
      .order("university_name", { ascending: true });

    // Track filter (server-side)
    if (track) query = query.eq("track", track);

    const { data, error } = await query;

    if (error) {
      setStatus(`Error: ${error.message}`);
      setLoading(false);
      return;
    }

    const greNum = Number(gre || 0);
    const toeflNum = Number(toefl || 0);

    // Client-side filters
    const filtered = (data ?? []).filter((p: Row) => {
      // GRE optional/waived toggle
      if (onlyGreOptional && !(p.gre_required === "optional" || p.gre_required === "waived")) {
        return false;
      }
      // GRE minimum logic
      if (greNum && p.gre_required === "required") {
        if (p.gre_min_total && greNum < p.gre_min_total) return false;
      }
      // TOEFL minimum logic
      if (toeflNum) {
        if (p.toefl_min_total && toeflNum < p.toefl_min_total) return false;
      }
      return true;
    });

    setRows(filtered);
    setStatus(`Found ${filtered.length} program(s).`);
    setLoading(false);
  }

  // Run once on load (same as original HTML)
  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Study Advisor — Program Finder (MVP)</h1>

      {/* Filters */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-slate-600">GRE score (optional)</label>
          <input
            value={gre}
            onChange={(e) => setGre(e.target.value)}
            type="number"
            placeholder="e.g. 305"
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-600">TOEFL score (optional)</label>
          <input
            value={toefl}
            onChange={(e) => setToefl(e.target.value)}
            type="number"
            placeholder="e.g. 90"
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-600">Track</label>
          <select
            value={track}
            onChange={(e) => setTrack(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">Any</option>
            <option>CS</option>
            <option>Data</option>
            <option>AI</option>
            <option>Cyber</option>
            <option>IT</option>
            <option>IS</option>
            <option>SE</option>
            <option>Networks</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={search}
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      <div className="mt-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyGreOptional}
            onChange={(e) => setOnlyGreOptional(e.target.checked)}
          />
          <span>Show programs where GRE is optional/waived</span>
        </label>
      </div>

      <div className="mt-3 text-sm text-slate-600">{status}</div>

      {/* Results */}
      <div className="mt-4 space-y-3">
        {rows.map((p) => (
          <div key={p.program_id} className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">
                  {p.name || "Program"} — {p.university_name || "University"}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {p.program_url ? (
                    <>
                      <a className="underline" href={p.program_url} target="_blank" rel="noreferrer">
                        Program page
                      </a>
                      {p.website_url ? " • " : ""}
                    </>
                  ) : null}
                  {p.website_url ? (
                    <a className="underline" href={p.website_url} target="_blank" rel="noreferrer">
                      University
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 space-x-2">
                {p.track ? (
                  <span className="inline-block rounded-full border px-2 py-0.5 text-xs">{p.track}</span>
                ) : null}
                <span className="inline-block rounded-full border px-2 py-0.5 text-xs">
                  {p.stem === "Y" ? `STEM (OPT ${p.opt_months || 36}m)` : "Non-STEM"}
                </span>
              </div>
            </div>

            <div className="mt-2 text-sm text-slate-600">
              GRE: {p.gre_required || "n/a"} {p.gre_min_total ? `(min ${p.gre_min_total})` : ""} • English:{" "}
              {p.english_tests_accepted || "n/a"} {p.toefl_min_total ? `(TOEFL ≥ ${p.toefl_min_total})` : ""}{" "}
              {p.tuition_usd_per_year ? `• Tuition ~$${p.tuition_usd_per_year}/yr` : ""}
            </div>
          </div>
        ))}
      </div>

      {/* Helpful links back into app */}
      <div className="mt-8 text-sm text-slate-600">
        Tip: Save interesting programs in{" "}
        <Link className="underline" href="/saved">
          Saved
        </Link>{" "}
        and generate SOPs in{" "}
        <Link className="underline" href="/sops">
          SOPs
        </Link>
        .
      </div>
    </main>
  );
}
