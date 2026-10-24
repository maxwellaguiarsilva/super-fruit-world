export function showBootError(error) {
  document.body.innerHTML = `<pre style="color:#BF4040;font-family:'Comic Sans MS','Comic Sans',monospace;padding:20px;">BOOT ERROR:\n${error.message}\n\n${error.stack}</pre>`;
}
