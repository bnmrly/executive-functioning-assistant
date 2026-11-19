# Local development

From the repository root, run `npm --prefix dashboard run dev -- --port 5173 --strictPort` in the VS Code terminal. Alternatively, use Terminal → Run Task → Dashboard development server.

Open http://localhost:5173/#morning for the morning checklist inside the dashboard. Save changes in VS Code to refresh the preview automatically, including JavaScript, CSS, and HTML in `public/checklist/`. Checklist progress is saved for this browser address separately from the installed tablet app.

Keep the terminal running while editing. Stop it with Ctrl+C. If the server is already running, use its existing terminal instead of starting a second copy.

The installed Android app contains a bundled copy of the dashboard. Rebuild and reinstall the APK when ready to put finished changes on the tablet.
