// Study Advisor/lib/generator.ts
// Dev-only minimal PDF generator (valid single-page PDF).
// Replace with your real SOP PDF generator later.
export async function generateSopPdfBlob(): Promise<Blob> {
  // A tiny, valid 1-page PDF saying "SOP Generated (dev)"
  // Base64 built from a minimal PDF (Helvetica text).
  const base64 =
    'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCAzMDAgMTQ0XS9Db250ZW50cyA0IDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNSAwIFI+Pj4+PgplbmRvYmoKNCAwIG9iago8PC9MZW5ndGggNTU+PnN0cmVhbQpCVCAvRjEgMjQgVGYgNzIgMTAwIFRkIChTT1AgR2VuZXJhdGVkIChkZXYpKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZS9CYXNlRm9udC9IZWx2ZXRpY2E+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDEgbiAKMDAwMDAwMDA2MSAwIG4gCjAwMDAwMDAxMTUgMCAgbiAKMDAwMDAwMDI3NCAwIG4gCjAwMDAwMDAzODMgMCAgbiAKdHJhaWxlcgo8PC9TaXplIDYvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgoyNTkKJSVFT0Y=';

  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return new Blob([bytes], { type: 'application/pdf' });
}