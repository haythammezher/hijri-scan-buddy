import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { scanPassport, type PassportData } from "@/lib/passport.functions";
import { toHijri, formatGregorian } from "@/lib/hijri";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Passport to Hijri — Scan & Convert Dates" },
      { name: "description", content: "Scan a passport and convert its issue and expiry dates from Gregorian to Hijri." },
      { property: "og:title", content: "Passport to Hijri" },
      { property: "og:description", content: "Scan a passport and get issue and expiry dates in Hijri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

async function fileToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
  const max = 1800;
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = img.width * s; c.height = img.height * s;
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL("image/jpeg", 0.88);
}

function DateRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hijriEn = toHijri(value);
  const hijriAr = toHijri(value, "ar-SA");
  return (
    <div className="card-surface p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground" />
      <div className="mt-1 text-sm text-muted-foreground">{formatGregorian(value) ?? "Not detected"}</div>
      <div className="mt-4 border-t border-border pt-4">
        <div className="font-display text-2xl text-primary">{hijriEn ?? "—"}</div>
        {hijriAr && <div dir="rtl" className="mt-1 font-arabic text-xl text-foreground">{hijriAr}</div>}
      </div>
    </div>
  );
}

function Index() {
  const scan = useServerFn(scanPassport);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PassportData | null>(null);

  async function handle(file?: File) {
    if (!file) return;
    setError(null); setData(null); setLoading(true);
    try {
      const img = await fileToDataUrl(file);
      setPreview(img);
      setData(await scan({ data: { image: img } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto max-w-xl">
        <header className="text-center">
          <div className="font-arabic text-primary text-lg" dir="rtl">جواز السفر بالتاريخ الهجري</div>
          <h1 className="mt-2 font-display text-4xl text-foreground">Passport to Hijri</h1>
          <p className="mt-3 text-muted-foreground">Scan the photo page of a passport to see its issue and expiry dates in the Hijri calendar.</p>
        </header>

        <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />

        <button onClick={() => inputRef.current?.click()} disabled={loading}
          className="mt-8 w-full rounded-lg bg-primary px-6 py-4 text-lg font-medium text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-60">
          {loading ? "Reading passport…" : preview ? "Scan another passport" : "Scan passport"}
        </button>

        {preview && <img src={preview} alt="Scanned passport" className="mt-6 w-full rounded-lg border border-border" />}
        {error && <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

        {data && (
          <section className="mt-6 space-y-4">
            {(data.fullName || data.passportNumber) && (
              <div className="card-surface p-5 text-sm">
                {data.fullName && <div className="text-lg text-foreground">{data.fullName}</div>}
                <div className="text-muted-foreground">
                  {[data.passportNumber, data.nationality].filter(Boolean).join(" · ")}
                </div>
              </div>
            )}
            <DateRow label="Date of issue" value={data.issueDate ?? ""} onChange={(v) => setData({ ...data, issueDate: v })} />
            <DateRow label="Date of expiry" value={data.expiryDate ?? ""} onChange={(v) => setData({ ...data, expiryDate: v })} />
            <p className="text-center text-xs text-muted-foreground">Hijri dates use the Umm al-Qura calendar. Correct a date above if it was misread.</p>
          </section>
        )}
      </div>
    </main>
  );
}
