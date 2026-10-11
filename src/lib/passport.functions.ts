import { createServerFn } from "@tanstack/react-start";

export type PassportData = {
  fullName: string | null;
  passportNumber: string | null;
  nationality: string | null;
  issueDate: string | null; // YYYY-MM-DD
  expiryDate: string | null; // YYYY-MM-DD
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["fullName", "passportNumber", "nationality", "issueDate", "expiryDate"],
  properties: {
    fullName: { type: ["string", "null"] },
    passportNumber: { type: ["string", "null"] },
    nationality: { type: ["string", "null"] },
    issueDate: { type: ["string", "null"], description: "Gregorian date of issue, YYYY-MM-DD" },
    expiryDate: { type: ["string", "null"], description: "Gregorian date of expiry, YYYY-MM-DD" },
  },
};

export const scanPassport = createServerFn({ method: "POST" })
  .inputValidator((input: { image: string }) => {
    if (!input?.image?.startsWith("data:image/")) throw new Error("Invalid image");
    if (input.image.length > 12_000_000) throw new Error("Image too large");
    return input;
  })
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "passport", strict: true, schema } },
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Read this passport photo. Extract holder name, passport number, nationality, date of issue and date of expiry as Gregorian dates in YYYY-MM-DD. Use the MRZ to confirm expiry. Use null if unreadable.",
              },
              { type: "input_image", image_url: data.image },
            ],
          },
        ],
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Too many requests, please wait and try again.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits.");
      throw new Error(`Scan failed (${res.status}) ${t.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta") out += ev.delta;
        } catch {
          /* ignore partial */
        }
      }
    }
    if (!out) throw new Error("Could not read the passport. Try a clearer photo.");
    return JSON.parse(out) as PassportData;
  });
