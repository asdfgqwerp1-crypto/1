import Foundation

enum DebugSettings {
    static let consoleKey = "com.safarispoof.debugConsole"

    static var consoleEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: consoleKey) }
        set { UserDefaults.standard.set(newValue, forKey: consoleKey) }
    }
}

extension Notification.Name {
    static let debugConsoleSettingsChanged = Notification.Name("com.safarispoof.debugConsoleSettingsChanged")
}