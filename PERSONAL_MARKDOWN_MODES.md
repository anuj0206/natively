# Personal Markdown modes

This project is based on Natively, originally developed by Natively AI Private Limited.

This is an unofficial personal-use modification. The upstream license, branding, provenance and premium entitlement checks are retained.

## Use

Open **Modes** from the launcher, or choose **Add / edit** beside **MD mode** in the meeting overlay. In **Markdown modes**, choose **New mode**, name it, and attach a UTF-8 `.md` file. Review or edit the imported context, then choose **Save and use** to save and activate it. The live overlay also has an **MD mode** selector for switching saved presets.

The file is imported as a copy, not a live link. Reattach it to import later changes. Files must be at most 32 KB and context must be at most 8,000 characters, matching the upstream General-mode instruction limit. Oversized content is rejected rather than truncated. Up to 50 presets can be saved.

Presets persist in the desktop renderer's local storage. Selecting one applies its context through the existing public General-mode update and activation APIs. This cancels old answer streams and uses the normal prompt-building path. The original General context is retained and restored when clearing the selection. Existing paid templates, document ingestion, RAG, licenses and premium checks are unchanged. This feature does not need embeddings or an extra model download.

Context is sent to the selected AI provider during normal AI requests. Do not include API keys or passwords in Markdown files. Markdown is treated as text; embedded links and images are not fetched or executed by this feature. No Markdown content is committed to the repository.

## Development verification

`node --test src/lib/__tests__/markdownModes.test.mjs` exercises imports, selection, replacement, persistence, restore, deletion, failure rollback, and storage errors. The feature uses the same browser File, UTF-8 decoding, local storage, and existing IPC APIs on Windows and macOS; it adds no platform-specific native code or dependency.

Physical app and packaged-build checks on Windows and macOS are separate from these tests. A source checkout does not include the upstream private premium module.
