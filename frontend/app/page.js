"use client";
import { useState } from "react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getJson } from "@/lib";

// Starting values for the whole form (the API accepts all of these fields)
const DEFAULTS = {
  school: "GP", sex: "F", age: 17, address: "U", famsize: "GT3", Pstatus: "T",
  Medu: 2, Fedu: 2, Mjob: "other", Fjob: "other", reason: "course", guardian: "mother",
  traveltime: 1, studytime: 2, failures: 0, schoolsup: "no", famsup: "yes", paid: "no",
  activities: "no", nursery: "yes", higher: "yes", internet: "yes", romantic: "no",
  famrel: 4, freetime: 3, goout: 3, Dalc: 1, Walc: 1, health: 3, absences: 4,
};

const EDU = ["None", "Primary", "5th-9th grade", "Secondary", "Higher"];

// Friendly names for the chart
const LABELS = {
  studytime: "Study time", failures: "Past failures", absences: "Absences", higher: "Wants higher education",
  Medu: "Mother's education", Fedu: "Father's education", internet: "Internet access", Dalc: "Weekday alcohol",
  Walc: "Weekend alcohol", goout: "Going out", age: "Age", health: "Health", famrel: "Family relations",
  freetime: "Free time", schoolsup: "School support", famsup: "Family support", paid: "Paid classes",
  activities: "Activities", romantic: "Relationship", school: "School", sex: "Sex", address: "Address",
  Mjob: "Mother's job", Fjob: "Father's job", reason: "School reason", guardian: "Guardian",
  traveltime: "Travel time", famsize: "Family size", Pstatus: "Parents' status", nursery: "Nursery",
};

function Slider({ label, name, min, max, form, setForm }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between">
        <span>{label}</span>
        <b>{form[name]}</b>
      </span>
      <input
        type="range" min={min} max={max} value={form[name]} className="w-full accent-indigo-600"
        onChange={(e) => setForm({ ...form, [name]: Number(e.target.value) })}
      />
    </label>
  );
}

function Select({ label, name, options, form, setForm, number }) {
  return (
    <label className="block text-sm">
      <span>{label}</span>
      <select
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: number ? Number(e.target.value) : e.target.value })}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-800"
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>{text}</option>
        ))}
      </select>
    </label>
  );
}

const YES_NO = [["yes", "Yes"], ["no", "No"]];
const EDU_OPTIONS = EDU.map((t, i) => [i, t]);

export default function Home() {
  const [form, setForm] = useState(DEFAULTS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await getJson("/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError("Could not get a prediction. Is the backend running? (" + err.message + ")");
    }
    setLoading(false);
  }

  const chartData = result
    ? result.top_factors.map((f) => ({
        name: (LABELS[f.feature] || f.feature) + " = " + f.value,
        impact: f.impact,
      }))
    : [];

  const p = { form, setForm };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow dark:bg-slate-800">
        <h1 className="text-xl font-bold">Student details</h1>
        <div className="grid grid-cols-2 gap-4">
          <Slider label="Age" name="age" min={15} max={22} {...p} />
          <Slider label="Study time (1-4)" name="studytime" min={1} max={4} {...p} />
          <Slider label="Past failures" name="failures" min={0} max={3} {...p} />
          <Slider label="Absences" name="absences" min={0} max={40} {...p} />
          <Slider label="Going out (1-5)" name="goout" min={1} max={5} {...p} />
          <Slider label="Free time (1-5)" name="freetime" min={1} max={5} {...p} />
          <Slider label="Weekday alcohol (1-5)" name="Dalc" min={1} max={5} {...p} />
          <Slider label="Weekend alcohol (1-5)" name="Walc" min={1} max={5} {...p} />
          <Slider label="Health (1-5)" name="health" min={1} max={5} {...p} />
          <Slider label="Family relations (1-5)" name="famrel" min={1} max={5} {...p} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Mother's education" name="Medu" options={EDU_OPTIONS} number {...p} />
          <Select label="Father's education" name="Fedu" options={EDU_OPTIONS} number {...p} />
          <Select label="Internet at home" name="internet" options={YES_NO} {...p} />
          <Select label="Wants higher education" name="higher" options={YES_NO} {...p} />
          <Select label="Extra school support" name="schoolsup" options={YES_NO} {...p} />
          <Select label="Family support" name="famsup" options={YES_NO} {...p} />
          <Select label="Paid extra classes" name="paid" options={YES_NO} {...p} />
          <Select label="In a relationship" name="romantic" options={YES_NO} {...p} />
          <Select label="Sex" name="sex" options={[["F", "Female"], ["M", "Male"]]} {...p} />
          <Select label="Home address" name="address" options={[["U", "Urban"], ["R", "Rural"]]} {...p} />
        </div>
        <button
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 p-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Predicting..." : "Predict final grade"}
        </button>
      </form>

      <div className="space-y-6">
        {error && (
          <p className="rounded-xl bg-red-100 p-4 text-red-800 dark:bg-red-900/40 dark:text-red-200">{error}</p>
        )}

        {!result && !error && !loading && (
          <p className="rounded-2xl bg-white p-5 text-slate-500 shadow dark:bg-slate-800">
            Fill in the form and press the button to see a prediction.
          </p>
        )}

        {loading && <p className="rounded-2xl bg-white p-5 shadow dark:bg-slate-800">Loading...</p>}

        {result && !loading && (
          <>
            <div className="rounded-2xl bg-white p-5 text-center shadow dark:bg-slate-800">
              <p className="text-sm text-slate-500">Predicted final grade (0-20)</p>
              <p className="text-6xl font-bold">{result.predicted_grade}</p>
              <p
                className={
                  "mt-3 inline-block rounded-full px-4 py-1 text-sm font-semibold " +
                  (result.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")
                }
              >
                {result.passed ? "On track to pass" : "At risk of failing"}
              </p>
              <p className="mt-2 text-xs text-slate-500">Pass mark is 10. This is an estimate, not a guarantee.</p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow dark:bg-slate-800">
              <h2 className="mb-1 font-bold">Top 5 factors</h2>
              <p className="mb-3 text-xs text-slate-500">
                Green pushes the grade up, red pushes it down (in grade points).
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                  <Tooltip />
                  <ReferenceLine x={0} stroke="#94a3b8" />
                  <Bar dataKey="impact">
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.impact >= 0 ? "#16a34a" : "#dc2626"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
