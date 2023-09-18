function insertScript(html: string, script: string, indentifier: string) {
  const searchRegex = new RegExp(indentifier, 'g');
  const htmlAfterInjectingScript = html.replace(
    searchRegex,
    script + indentifier
  );

  return htmlAfterInjectingScript;
}

export function insertScriptInBottom(html: string, script: string) {
  return insertScript(html, script, '</body>');
}

export function insertScriptInTop(html: string, script: string) {
  return insertScript(html, script, '</head>');
}
