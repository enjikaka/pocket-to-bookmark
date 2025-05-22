// Usage: deno run --allow-read --allow-write pocket-to-bookmarks.js pocket.csv bookmarks.html
import { parse } from "jsr:@jlarky/csv-parse";

type Bookmark = {
  title: string;
  url: string;
  timeAdded: number;
  status: string;
};

const [inputPath, outputPath] = Deno.args;
if (!inputPath || !outputPath) {
  console.error("Usage: deno run --allow-read --allow-write pocket-to-bookmarks.js input.csv output.html");
  Deno.exit(1);
}

const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

const csvText = decoder.decode(await Deno.readFile(inputPath));
const lines = csvText.trim().split("\n");
const headers = lines[0].split(",");

// Minimal CSV parser with quote handling
async function parseCSVLine(line: string) {
  const result = await parse(line);

  if (result.success) {
    return result.records[0];
  } else {
    throw new Error(result.err.toString());
  }
}

const allBookmarks: Bookmark[] = await Promise.all(lines.slice(1).map(async line => {
  const fields = await parseCSVLine(line);
  const entry = Object.fromEntries(headers.map((key, i) => [key, fields[i] || ""]));

  return {
    title: entry.title || entry.url,
    url: entry.url,
    timeAdded: parseInt(entry.time_added) || Date.now() / 1000,
    status: entry.status,
  };
}));

const filteredBookmarks = allBookmarks.filter(b => b.status === "unread")
  .sort((a, b) => a.timeAdded - b.timeAdded);

function escapeHTML(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function generateBookmarkHTML(bookmarks: Bookmark[]) {
  const lines = [];
  lines.push(`<!DOCTYPE NETSCAPE-Bookmark-file-1>`);
  lines.push(`<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">`);
  lines.push(`<TITLE>Pocket Export</TITLE>`);
  lines.push(`<H1>Pocket Export</H1>`);
  lines.push(`<DL><p>`);
  lines.push(`  <DT><H3>Pocket</H3>`);
  lines.push(`  <DL><p>`);

  for (const bm of bookmarks) {
    const addDate = Math.floor(bm.timeAdded);
    lines.push(
      `    <DT><A HREF="${escapeHTML(bm.url)}" ADD_DATE="${addDate}">${escapeHTML(bm.title)}</A>`
    );
  }

  lines.push(`  </DL><p>`);
  lines.push(`</DL><p>`);
  return lines.join("\n");
}

const htmlOutput = generateBookmarkHTML(filteredBookmarks);
await Deno.writeFile(outputPath, encoder.encode(htmlOutput));

console.log(`✅ Exporterade ${allBookmarks.length} unread-bokmärken → ${outputPath}`);

