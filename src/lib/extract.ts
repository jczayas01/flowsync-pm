// src/lib/extract.ts
// Shared server-side text extraction for uploaded/stored files.
// Supports: .docx/.doc (mammoth), .pdf (unpdf), .xlsx (exceljs),
// .pptx (jszip), .msg (msgreader), and plain-text formats.

export async function extractTextFromBuffer(fileName: string, buffer: Buffer): Promise<string> {
  const name = (fileName || "").toLowerCase()
  let text = ""

  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    const mammoth: any = await import("mammoth")
    const extract = mammoth.extractRawText || mammoth.default?.extractRawText
    const result = await extract({ buffer })
    text = result?.value || ""
  } else if (name.endsWith(".pdf")) {
    const { extractText } = await import("unpdf")
    const result = await extractText(new Uint8Array(buffer), { mergePages: true })
    text = (result?.text as string) || ""
  } else if (name.endsWith(".xlsx")) {
    const ExcelJSmod: any = await import("exceljs")
    const ExcelJS = ExcelJSmod.default || ExcelJSmod
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)
    const out: string[] = []
    wb.eachSheet((ws: any) => {
      out.push(`## Sheet: ${ws.name}`)
      ws.eachRow((row: any) => {
        const vals = (row.values || []).slice(1).map((v: any) => {
          if (v == null) return ""
          if (v instanceof Date) return v.toISOString().slice(0, 10)
          if (typeof v === "object") {
            return v.text || v.result ||
              (v.richText ? v.richText.map((r: any) => r.text).join("") : "") || ""
          }
          return String(v)
        })
        out.push(vals.join("\t"))
      })
    })
    text = out.join("\n")
  } else if (name.endsWith(".pptx")) {
    const JSZip = ((await import("jszip")) as any).default
    const zip = await JSZip.loadAsync(buffer)
    const num = (n: string) => parseInt(n.match(/slide(\d+)/)?.[1] || "0")
    const slides = Object.keys(zip.files)
      .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => num(a) - num(b))
    const dec = (s: string) => s
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    const out: string[] = []
    for (const sf of slides) {
      const xml = await zip.files[sf].async("string")
      const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)]
        .map(m => dec(m[1])).filter(Boolean)
      out.push(`## Slide ${num(sf)}\n${texts.join(" ")}`)
    }
    text = out.join("\n")
  } else if (name.endsWith(".msg")) {
    const mod: any = await import("@kenjiuno/msgreader")
    const MsgReader = mod.default?.default || mod.default || mod.MsgReader
    const data = new MsgReader(buffer).getFileData()
    const rawHtml = data.html instanceof Uint8Array
      ? Buffer.from(data.html).toString("utf-8")
      : String(data.html || data.bodyHtml || "")
    const htmlText = rawHtml
      .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/\s+/g, " ").trim()
    const body = (data.body || "").trim() || htmlText
    const to = (data.recipients || []).map((r: any) => r.name || r.smtpAddress || "").filter(Boolean).join(", ")
    text = [
      `From: ${data.senderName || ""} ${data.senderSmtpAddress || data.senderEmail || ""}`.trim(),
      to ? `To: ${to}` : "",
      `Subject: ${data.subject || ""}`,
      data.messageDeliveryTime ? `Date: ${data.messageDeliveryTime}` : "",
      "",
      body,
    ].filter(l => l !== "").join("\n")
  } else if (name.endsWith(".xls") || name.endsWith(".ppt")) {
    throw new Error("Legacy .xls/.ppt formats aren't supported — save the file as .xlsx or .pptx and try again")
  } else {
    text = buffer.toString("utf-8")
  }

  return (text || "").trim()
}
