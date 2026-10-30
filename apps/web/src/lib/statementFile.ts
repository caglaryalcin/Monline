/** Read and fingerprint locally, without loading the PDF parser or uploading bytes. */
export async function readStatementFile(file: File) {
  if (!/\.pdf$/i.test(file.name) || file.size > 20 * 1024 * 1024)
    throw new Error("statement_invalid_file");
  const buffer = await file.arrayBuffer();
  const header = new TextDecoder().decode(buffer.slice(0, 1024));
  if (!header.includes("%PDF-")) throw new Error("statement_invalid_file");
  if (!globalThis.crypto?.subtle) throw new Error("statement_secure_context");
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const fileHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { buffer, fileHash };
}
