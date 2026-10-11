import type { PassportData } from "./passport.functions";
import { toHijri, formatGregorian } from "./hijri";

function rows(d: PassportData) {
  return [
    ["Date of issue", formatGregorian(d.issueDate) ?? "—", toHijri(d.issueDate) ?? "—", toHijri(d.issueDate, "ar-SA") ?? "—"],
    ["Date of expiry", formatGregorian(d.expiryDate) ?? "—", toHijri(d.expiryDate) ?? "—", toHijri(d.expiryDate, "ar-SA") ?? "—"],
  ];
}

const fileBase = (d: PassportData) => `passport-dates${d.passportNumber ? "-" + d.passportNumber : ""}`;

export async function exportPdf(d: PassportData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text("Passport Dates — Gregorian & Hijri", 20, 25);
  doc.setFontSize(11);
  let y = 40;
  for (const [k, v] of [["Name", d.fullName], ["Passport no.", d.passportNumber], ["Nationality", d.nationality]]) {
    if (v) { doc.text(`${k}: ${v}`, 20, y); y += 7; }
  }
  y += 6;
  for (const [label, g, h] of rows(d)) {
    doc.setFontSize(13); doc.text(label!, 20, y); y += 8;
    doc.setFontSize(11);
    doc.text(`Gregorian: ${g}`, 26, y); y += 7;
    doc.text(`Hijri (Umm al-Qura): ${h}`, 26, y); y += 12;
  }
  await deliver(doc.output("blob"), `${fileBase(d)}.pdf`);
}

export async function exportExcel(d: PassportData) {
  const XLSX = await import("xlsx");
  const data = [
    ["Name", d.fullName ?? ""],
    ["Passport no.", d.passportNumber ?? ""],
    ["Nationality", d.nationality ?? ""],
    [],
    ["", "Gregorian", "Hijri", "Hijri (Arabic)"],
    ...rows(d),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 16 }, { wch: 22 }, { wch: 26 }, { wch: 26 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Passport dates");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  await deliver(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${fileBase(d)}.xlsx`,
  );
}

async function deliver(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type });
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (mobile && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
