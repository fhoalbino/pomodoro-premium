// Pomodoro Premium — Tauri 2 entrypoint.
// Pure frontend app: no custom commands needed. The webview loads the existing
// HTML/CSS/JS shell from the parent directory (configured in tauri.conf.json).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            // Hook here for future native integrations (tray, notifications, etc.).
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Pomodoro Premium");
}
