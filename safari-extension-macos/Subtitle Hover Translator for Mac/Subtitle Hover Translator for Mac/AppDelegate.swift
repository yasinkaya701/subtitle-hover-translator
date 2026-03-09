//
//  AppDelegate.swift
//  Subtitle Hover Translator for Mac
//
//  Created by Yasin Kaya on 8.03.2026.
//

import Cocoa
import SafariServices

private let automationLaunchArgument = "--open-safari-extension-preferences"
private let safariBundleIdentifier = "com.apple.Safari"

@main
class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard ProcessInfo.processInfo.arguments.contains(automationLaunchArgument) else {
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.launchSafariAndOpenPreferences()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    private func launchSafariAndOpenPreferences() {
        guard let safariURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: safariBundleIdentifier) else {
            openExtensionPreferences()
            return
        }

        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true

        NSWorkspace.shared.openApplication(at: safariURL, configuration: configuration) { _, error in
            if let error = error {
                NSLog("Failed to launch Safari before opening extension preferences: %@", error.localizedDescription)
                self.openExtensionPreferences()
                return
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.openExtensionPreferences()
            }
        }
    }

    private func openExtensionPreferences() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            if let error = error {
                NSLog("Failed to open Safari extension preferences: %@", error.localizedDescription)
            }
        }
    }

}
