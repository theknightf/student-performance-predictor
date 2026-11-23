"use client";
import { useEffect, useState } from "react";
import { getJson } from "@/lib";

function Table({ title, note, rows, best }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow dark:bg-slate-800">
      <h2 className="font-bold">{title}</h2>
      <p className="mb-3 text-sm text-slate-500">{note}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="p-2">Model</th>
              <th className="p-2">CV RMSE</th>
              <th className="p-2">Test RMSE</th>
              <th className="p-2">Test MAE</th>
              <th className="p-2">Test R²</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(rows).map(([name, r]) => (
              <tr key={name} className="border-b border-slate-100 dark:border-slate-700/50">
                <td className="p-2 font-medium">
                  {name} {name === best && "(deployed)"}
                </td>
                <td className="p-2">{r.cv_rmse.toFixed(2)}</td>
                <td className="p-2">{r.rmse.toFixed(2)}</td>
                <td className="p-2">{r.mae.toFixed(2)}</td>
                <td className="p-2">{r.r2.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Performance() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getJson("/model-info")
      .then(setInfo)
      .catch((e) => setError("Could not load metrics: " + e.message));
  }, []);

  if (error) return <p className="rounded-xl bg-red-100 p-4 text-red-800">{error}</p>;
  if (!info) return <p>Loading...</p>;

  const s = info.best_scores;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Model performance</h1>
      <p>
        The app uses <b>{info.best_model}</b> trained <i>without</i> the earlier grades (G1, G2), so it can
        predict early in the year.
      </p>
      <div className="grid grid-cols-3 gap-4 text-center">
        {[["RMSE", s.rmse], ["MAE", s.mae], ["R²", s.r2]].map(([name, value]) => (
          <div key={name} className="rounded-2xl bg-white p-4 shadow dark:bg-slate-800">
            <p className="text-sm text-slate-500">{name}</p>
            <p className="text-3xl font-bold">{value.toFixed(2)}</p>
          </div>
        ))}
      </div>
      <Table
        title="Without G1/G2 (early prediction)"
        note="Realistic: only background information is known."
        rows={info.early}
        best={info.best_model}
      />
      <Table
        title="With G1/G2"
        note="Much more accurate, but only possible once earlier grades exist."
        rows={info.full}
        best={null}
      />
      <p className="text-sm text-slate-500">
        RMSE and MAE are in grade points (lower is better). R² closer to 1 is better.
      </p>
    </div>
  );
}
