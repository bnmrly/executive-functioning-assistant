# Local development

## Calendar workflow

Google Calendar is the single place to add and edit plans, reminders, and appointments. Users can edit their synced calendar in Google Calendar on any device. The Android tablet reads Beth’s Calendar through Google Calendar sync and displays its events on Today and Calendar. Keep both views read-only for calendar data. Do not bring back Today’s notes in Parent mode or add local storage for dated plans.

When the user asks in Codex for a calendar change, use the connected Google Calendar connector to edit Beth’s Calendar. Check for matching events first and group any missing questions together. Use Europe/London for dates and times.

- Use all-day events named `School plan: …` or `Home plan: …` for special days and day-long reminders, such as Christmas jumper day or a birthday.
- Use timed events for appointments and activities with a known start time, such as a school performance.

## Use the Codex preview for everyday edits

Use the in-app browser in Codex for layout, colours, text, and other web changes. Reuse the open preview tab so edits are easy to follow. The tablet can stay disconnected during this work.

From the repository root, run `npm --prefix dashboard run dev -- --port 5173 --strictPort` in the VS Code terminal. Alternatively, use Terminal → Run Task → Dashboard development server.

Open [Today](http://localhost:5173/#home) or the [Morning checklist](http://localhost:5173/#morning) in the Codex browser. Save changes in VS Code to refresh the preview automatically, including JavaScript, CSS, and HTML in `public/checklist/`. Checklist progress is saved for this browser address separately from the installed tablet app.

Today and Calendar in the Codex preview can use a temporary local Google Calendar snapshot. When asked to verify real events in the preview, refresh the snapshot for the relevant dates through the connected Google Calendar connector and keep it out of Git. Dates outside the snapshot may show labelled sample events. The tablet mirror reads the tablet's synced calendar directly.

Keep the terminal running while editing. Stop it with Ctrl+C. If the server is already running, use its existing terminal instead of starting a second copy.

The installed Android app contains a bundled copy of the dashboard. Rebuild and reinstall the APK when ready to put finished changes on the tablet.

## Use the tablet mirror for device checks

Open the mirror when checking real synced calendar events, touch controls, or how the dashboard fits the tablet screen.

Always start the tablet mirror with mouse and keyboard control enabled. This is the user's standing preference for development. Do not use scrcpy's `--no-control` option unless the user explicitly requests view-only mirroring.

Run this from the repository root in the VS Code terminal:

```sh
npm --prefix dashboard run dev:tablet
```

Or use Terminal → Run Task → Live tablet preview with calendar. The tablet must be connected to ADB. If several devices are attached, pass the tablet serial after `--`.

This single command starts the development server if needed, forwards it to the tablet, enables calendar access for this preview session, and opens an interactive mirror of the actual tablet screen. Edit and save files to see them refresh there. Today and Calendar read the tablet's real synced events. The Mac browser preview cannot read Android's calendar; use the tablet mirror when checking events.

Keep the terminal and mirror open while editing. Closing the mirror returns the tablet to its installed offline dashboard. The preview URL and calendar access are not saved as the normal launch settings. The installed app must include the live-preview support; installing that native update is only needed once, then web edits do not need APK rebuilds.

## Build and install a finished version

1. Run `npm --prefix dashboard run build` to create `dashboard/dist`.
2. Build with `dashboard/kiosk/build.sh`, setting `KIOSK_SITE` to the absolute path of `dashboard/dist`. Use the existing signing keystore through `KIOSK_KEYSTORE`, and the installed JDK/Android SDK paths described in the kiosk build script. Reuse the same signing key for every update.
3. Install with `adb -s <tablet> install --no-incremental -r dashboard/kiosk/build/homehq.apk`.
4. Return to the bundled site:

```sh
adb -s <tablet> shell am start -n com.wesbos.homehq/.MainActivity --es url 'http://127.0.0.1:8765/'
```

The APK includes the finished web files and works without the development computer. Updates preserve the installed app, its data, and its home-screen icon. Android Java or manifest changes require an APK rebuild even during development.
