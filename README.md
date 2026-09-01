## zotero-roam
 
![GitHub package.json version](https://img.shields.io/github/package-json/v/8bitgentleman/zotero-roam?style=flat-square) ![File size in bytes for extension.js](https://img.shields.io/github/size/8bitgentleman/zotero-roam/extension.js?label=size%20%28minified%29&style=flat-square) ![License](https://img.shields.io/github/license/8bitgentleman/zotero-roam) ![Maintenance](https://img.shields.io/maintenance/yes/2026?style=flat-square)

The extension documentation is available [on GitBook](https://alix-lahuec.gitbook.io/zotero-roam/). If you run into any issues/bugs, or have difficulties getting setup, please [create an issue](https://github.com/8bitgentleman/zotero-roam/issues).

### AI tools (Roam MCP)

On Roam builds that support extension AI tools, zoteroRoam registers three tools that agents connected through [Roam's MCP server](https://github.com/Roam-Research/roam-tools) can discover via `get_graph_guidelines` (in the `extensionTools` field) and invoke via `call_extension_tool`:

- `zotero-search-items` (read): searches the loaded Zotero items by citekey, DOI, Zotero item key, or title substring. Returns compact summaries, including each item's citekey and whether it already has a Roam page.
- `zotero-import-metadata` (edit): the headless equivalent of the "Import metadata" button. Creates the item's `[[@citekey]]` page if needed and imports its metadata using your configured settings (default formatter, custom function, or SmartBlock). By default the call is refused if the page already has content, to avoid duplicate imports; pass `allowDuplicate: true` to override.
- `zotero-import-notes` (edit): the headless equivalent of the "Import notes" button. Imports the item's notes and PDF annotations, formatted with your notes/annotations settings.

The tools read your current settings at call time and write to the graph exactly as the corresponding buttons would. On Roam builds that predate extension AI tools, registration is skipped silently.

