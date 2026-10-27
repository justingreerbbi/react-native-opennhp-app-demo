import XCTest

final class OpenNHPAgentUITests: XCTestCase {
  // This test talks to the live nhp-server. A helper writes the emailed
  // 6-digit code to /tmp/opennhp-otp.txt while the test is running.
  private let emailAddress = "agent.ios@example.com"

  override func setUpWithError() throws {
    continueAfterFailure = false
  }

  func testKnockOpensSite() throws {
    let app = XCUIApplication()
    app.launch()

    let knock = app.buttons["knock"]
    XCTAssertTrue(knock.waitForExistence(timeout: 20))
    let knockEnabled = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "enabled == true"),
      object: knock
    )
    XCTAssertEqual(XCTWaiter().wait(for: [knockEnabled], timeout: 15), .completed)
    if knock.isHittable {
      knock.tap()
    } else {
      knock.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    let status = try waitForStatus(app, until: { text in
      text.contains("Knock succeeded") || text.contains("Knock failed") || text.contains("failed")
    }, timeout: 90)
    XCTAssertTrue(status.contains("Knock succeeded"), "Knock status: \(status)")
  }

  func testRegisterThenKnock() throws {
    let app = XCUIApplication()
    app.launch()

    let email = app.textFields["email"]
    XCTAssertTrue(email.waitForExistence(timeout: 40), "Email field did not appear")
    replace(email, with: emailAddress)
    XCTAssertEqual(email.value as? String, emailAddress)

    let send = app.buttons["send-code"]
    XCTAssertTrue(send.waitForExistence(timeout: 5))
    if !send.isHittable {
      email.typeText("\n")
    }
    XCTAssertTrue(send.isEnabled)
    send.tap()

    var status = try waitForStatus(app, until: { text in
      text.contains("Code requested") || text.contains("failed") || text.contains("Failed")
    }, timeout: 90)
    XCTAssertTrue(status.contains("Code requested"), "OTP request status: \(status)")

    let otp = try waitForOtpFile()
    let otpField = app.textFields["otp"]
    XCTAssertTrue(otpField.waitForExistence(timeout: 5))
    replace(otpField, with: otp)
    XCTAssertEqual(otpField.value as? String, otp)

    let register = app.buttons["register"]
    let registerEnabled = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "enabled == true"),
      object: register
    )
    XCTAssertEqual(XCTWaiter().wait(for: [registerEnabled], timeout: 10), .completed)
    if register.isHittable {
      register.tap()
    } else {
      register.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    status = try waitForStatus(app, until: { text in
      text.contains("errCode 0") ||
        ((text.contains("failed") || text.contains("Failed")) && !text.contains("Sending"))
    }, timeout: 90)
    XCTAssertTrue(status.contains("errCode 0"), "Registration status: \(status)")

    let knock = app.buttons["knock"]
    XCTAssertTrue(knock.waitForExistence(timeout: 5))
    let knockEnabled = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "enabled == true"),
      object: knock
    )
    XCTAssertEqual(XCTWaiter().wait(for: [knockEnabled], timeout: 10), .completed)
    if knock.isHittable {
      knock.tap()
    } else {
      knock.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    status = try waitForStatus(app, until: { text in
      text.contains("Knock succeeded") || text.contains("Knock failed") || text.contains("failed to start")
    }, timeout: 90)
    XCTAssertTrue(status.contains("Knock succeeded"), "Knock status: \(status)")
  }

  private func replace(_ field: XCUIElement, with text: String) {
    field.tap()
    RunLoop.current.run(until: Date().addingTimeInterval(0.4))
    clear(field)
    UIPasteboard.general.string = text
    field.press(forDuration: 1.1)
    let paste = XCUIApplication().menuItems["Paste"]
    if paste.waitForExistence(timeout: 2) {
      paste.tap()
    }
    if (field.value as? String) != text {
      clear(field)
      field.typeText(text)
    }
  }

  private func clear(_ field: XCUIElement) {
    field.press(forDuration: 1.1)
    let selectAll = XCUIApplication().menuItems["Select All"]
    if selectAll.waitForExistence(timeout: 1) {
      selectAll.tap()
      field.typeText(XCUIKeyboardKey.delete.rawValue)
    }
    var guardrail = 0
    while let current = field.value as? String,
          current != field.placeholderValue,
          !current.isEmpty,
          guardrail < 4 {
      field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count + 1))
      guardrail += 1
    }
  }

  private func waitForStatus(
    _ app: XCUIApplication,
    until matches: (String) -> Bool,
    timeout: TimeInterval
  ) throws -> String {
    let status = app.staticTexts["status"]
    XCTAssertTrue(status.waitForExistence(timeout: 5))
    let deadline = Date().addingTimeInterval(timeout)
    var last = status.label
    while Date() < deadline {
      last = status.label
      if matches(last) {
        return last
      }
      RunLoop.current.run(until: Date().addingTimeInterval(0.4))
    }
    return last
  }

  private func waitForOtpFile() throws -> String {
    let url = URL(fileURLWithPath: "/tmp/opennhp-otp.txt")
    let deadline = Date().addingTimeInterval(90)
    while Date() < deadline {
      if let text = try? String(contentsOf: url, encoding: .utf8) {
        let code = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if code.count == 6, code.allSatisfy(\.isNumber) {
          return code
        }
      }
      RunLoop.current.run(until: Date().addingTimeInterval(1))
    }
    XCTFail("Timed out waiting for the one-time code")
    return ""
  }
}
