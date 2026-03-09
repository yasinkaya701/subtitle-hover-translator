//
//  ViewController.swift
//  Subtitle Hover Translator
//
//  Created by Yasin Kaya on 8.03.2026.
//

import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self
        self.webView.scrollView.isScrollEnabled = false

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Override point for customization.
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let command = message.body as? String else {
            return
        }

        if command == "open-settings" {
            openSafariSettings()
        }
    }

    private func openSafariSettings() {
        let candidateURLs = [
            "App-Prefs:root=SAFARI&path=Extensions",
            "App-Prefs:root=SAFARI&path=EXTENSIONS",
            "App-Prefs:root=SAFARI",
            UIApplication.openSettingsURLString
        ].compactMap(URL.init(string:))

        openNextSettingsURL(candidateURLs)
    }

    private func openNextSettingsURL(_ urls: [URL]) {
        guard let url = urls.first else {
            return
        }

        UIApplication.shared.open(url, options: [:]) { [weak self] success in
            if !success {
                self?.openNextSettingsURL(Array(urls.dropFirst()))
            }
        }
    }

}
