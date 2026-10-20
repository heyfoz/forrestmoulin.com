# Tab Recorder interface variation

The extension in `extension/` is the TabRecord app with a cleaner interface and a persistent light/dark theme. It follows the system appearance until you choose a theme. Original recording, file transcription, TXT and WebVTT exports are retained. Version: 2.4.

## Try it

Open `/tab-recorder/index.html` on the portfolio dev server, or open the Tab Recorder project notes. The clearly labeled preview plays sample text, exports that sample as TXT, and lets you explore both themes and modes. It does not capture audio, accept API keys, or upload files.

For real recording, download and extract `tab-recorder.zip`, then use Chrome's Extensions page → Developer mode → Load unpacked and choose the extracted folder. If you already load the original TabRecord folder, reload that extension instead. Add your own Deepgram API key in Transcription settings.

## Source and packaging

The source app remains in the sibling `TabRecord` directory. Run `node scripts/sync-tab-recorder.mjs` from the portfolio root to refresh this checked-in extension copy, ZIP, and preview HTML. Supply a different source path as an argument if needed. Preview-only interactions live in `preview.js`. The normal portfolio build uses these checked-in files and does not depend on the sibling folder. Screenshot assets show the labeled sample preview; earlier real recording evidence remains in the project notes.
