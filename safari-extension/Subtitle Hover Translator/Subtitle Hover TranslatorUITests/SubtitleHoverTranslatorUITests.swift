import XCTest

final class SubtitleHoverTranslatorUITests: XCTestCase {
    private let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    private let extensionName = "Subtitle Hover Translator"
    private let appsLabels = ["Apps", "Uygulamalar"]
    private let searchLabels = ["Arayin", "Arayın", "Search"]
    private let extensionsLabels = ["Extensions", "Uzantilar", "Uzantılar", "WEB_EXTENSIONS"]
    private let settingsRootLabels = ["Ayarlar", "Settings"]

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testEnableSafariExtensionInSettings() throws {
        settings.activate()
        XCTAssertTrue(settings.wait(for: .runningForeground, timeout: 20))
        XCTAssertTrue(waitForSettingsRoot(), "Settings kok ekranina ulasilamadi.")

        XCTAssertTrue(
            scrollToAndTap(labels: appsLabels, maxSwipes: 16),
            "Settings kok ekraninda Apps/Uygulamalar bolumu bulunamadi."
        )
        XCTAssertTrue(openSearch(), "Settings arama alani acilamadi.")
        let searchField = settings.searchFields.firstMatch
        XCTAssertTrue(searchField.waitForExistence(timeout: 5), "Settings arama alani bulunamadi.")
        clearSearchField(searchField)
        searchField.typeText("Safari")
        tapKeyboardSearchIfPresent()

        XCTAssertTrue(
            tapFirstMatchingElement(labels: ["Safari"], timeout: 8),
            "Apps aramasinda Safari bulunamadi."
        )
        XCTAssertTrue(
            scrollToAndTap(labels: extensionsLabels, maxSwipes: 12),
            "Safari ayarlari icinde Extensions bolumu bulunamadi."
        )
        XCTAssertTrue(
            scrollToAndTap(labels: [extensionName], maxSwipes: 10),
            "Subtitle Hover Translator hucre si Safari Extensions ekraninda bulunamadi."
        )

        let toggle = settings.switches.element(boundBy: 0)
        XCTAssertTrue(toggle.waitForExistence(timeout: 10), "Uzanti acma anahtari bulunamadi.")

        if toggleValue(toggle) != "1" {
            tapSwitchControl(toggle)
        }

        XCTAssertEqual(toggleValue(toggle), "1", "Uzanti anahtari acik duruma gecmedi.")
    }

    private func waitForSettingsRoot() -> Bool {
        let deadline = Date().addingTimeInterval(8)

        repeat {
            if existingMatchingElement(labels: settingsRootLabels) != nil {
                return true
            }

            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        } while Date() < deadline

        return settings.searchFields.firstMatch.exists
    }

    private func openSearch() -> Bool {
        for _ in 0..<4 {
            if let field = existingSearchField(), field.exists {
                if field.isHittable {
                    field.tap()
                }

                return true
            }

            settings.swipeDown()
        }

        return false
    }

    private func scrollToAndTap(labels: [String], maxSwipes: Int) -> Bool {
        for _ in 0..<maxSwipes {
            if let element = existingMatchingElement(labels: labels), isVisibleOnScreen(element) {
                element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
                return true
            }

            settings.swipeUp()
        }

        if let element = existingMatchingElement(labels: labels), isVisibleOnScreen(element) {
            element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            return true
        }

        return false
    }

    private func existingSearchField() -> XCUIElement? {
        let candidates = [
            settings.searchFields.firstMatch,
            settings.otherElements.matching(predicateForLabels(searchLabels)).firstMatch,
            settings.staticTexts.matching(predicateForLabels(searchLabels)).firstMatch
        ]

        for candidate in candidates where candidate.exists {
            return candidate
        }

        return nil
    }

    private func clearSearchField(_ element: XCUIElement) {
        guard let currentValue = element.value as? String else {
            return
        }

        if searchLabels.contains(currentValue) {
            return
        }

        let clearButton = settings.buttons.matching(predicateForLabels(["Clear text", "Temizle"])).firstMatch
        if clearButton.exists {
            clearButton.tap()
            return
        }

        let deleteSequence = String(repeating: XCUIKeyboardKey.delete.rawValue, count: currentValue.count)
        element.tap()
        element.typeText(deleteSequence)
    }

    private func isVisibleOnScreen(_ element: XCUIElement) -> Bool {
        let frame = element.frame
        guard !frame.isEmpty else {
            return false
        }

        let window = settings.windows.firstMatch
        let windowFrame = window.exists ? window.frame : CGRect(x: 0, y: 0, width: 402, height: 874)
        return frame.intersects(windowFrame)
    }

    private func tapKeyboardSearchIfPresent() {
        let searchButton = settings.keyboards.buttons.matching(predicateForLabels(["Ara", "Search"])).firstMatch
        if searchButton.exists {
            searchButton.tap()
            RunLoop.current.run(until: Date().addingTimeInterval(0.5))
        }
    }

    private func tapSwitchControl(_ element: XCUIElement) {
        element.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        RunLoop.current.run(until: Date().addingTimeInterval(0.5))
    }

    private func tapFirstMatchingElement(labels: [String], timeout: TimeInterval) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)

        repeat {
            if let element = existingMatchingElement(labels: labels), element.isHittable {
                element.tap()
                return true
            }

            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        } while Date() < deadline

        if let element = existingMatchingElement(labels: labels) {
            element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            return true
        }

        return false
    }

    private func existingMatchingElement(labels: [String]) -> XCUIElement? {
        let compound = predicateForLabels(labels)

        let candidates = [
            settings.buttons.matching(compound).firstMatch,
            settings.staticTexts.matching(compound).firstMatch,
            settings.cells.matching(compound).firstMatch,
            settings.searchFields.matching(compound).firstMatch,
            settings.otherElements.matching(compound).firstMatch
        ]

        for candidate in candidates where candidate.exists {
            return candidate
        }

        return nil
    }

    private func predicateForLabels(_ labels: [String]) -> NSPredicate {
        let predicates = labels.flatMap { label in
            [
                NSPredicate(format: "label ==[cd] %@", label),
                NSPredicate(format: "label CONTAINS[cd] %@", label),
                NSPredicate(format: "identifier ==[cd] %@", label),
                NSPredicate(format: "identifier CONTAINS[cd] %@", label)
            ]
        }

        return NSCompoundPredicate(orPredicateWithSubpredicates: predicates)
    }

    private func toggleValue(_ element: XCUIElement) -> String {
        if let value = element.value as? String {
            return value
        }

        return "\(element.value ?? "")"
    }
}
