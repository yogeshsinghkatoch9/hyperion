import CoreGraphics
import Foundation

// Remote Input Helper — CGEvent-based mouse/keyboard injection + fast screen capture
// Compiled at first use: swiftc -O -o .cache/remoteInputHelper remoteInputHelper.swift -framework CoreGraphics -framework Foundation

let args = CommandLine.arguments

guard args.count >= 2 else {
    fputs("Usage: remoteInputHelper <capture|mouse|key|scroll> [args...]\n", stderr)
    exit(1)
}

let command = args[1]

switch command {

case "capture":
    // capture <outputPath> <quality> <scale>
    guard args.count >= 5 else { fputs("Usage: capture <path> <quality> <scale>\n", stderr); exit(1) }
    let outputPath = args[2]
    let quality = Double(args[3]) ?? 60.0
    let scale = Double(args[4]) ?? 0.5

    guard let displayID = CGMainDisplayID() as CGDirectDisplayID?,
          let screenshot = CGDisplayCreateImage(displayID) else {
        fputs("Failed to capture screen\n", stderr)
        exit(1)
    }

    let width = Int(Double(screenshot.width) * scale)
    let height = Int(Double(screenshot.height) * scale)

    let url = URL(fileURLWithPath: outputPath) as CFURL
    guard let dest = CGImageDestinationCreateWithURL(url, "public.jpeg" as CFString, 1, nil) else {
        fputs("Failed to create image destination\n", stderr)
        exit(1)
    }

    let options: [CFString: Any] = [
        kCGImageDestinationLossyCompressionQuality: quality / 100.0,
        kCGImagePropertyPixelWidth: width,
        kCGImagePropertyPixelHeight: height,
    ]
    CGImageDestinationAddImage(dest, screenshot, options as CFDictionary)
    CGImageDestinationFinalize(dest)

case "mouse":
    // mouse <action> <x> <y> [button]
    guard args.count >= 5 else { fputs("Usage: mouse <action> <x> <y> [button]\n", stderr); exit(1) }
    let action = args[2]
    let x = Double(args[3]) ?? 0
    let y = Double(args[4]) ?? 0
    let button = args.count > 5 ? args[5] : "left"
    let point = CGPoint(x: x, y: y)

    let mouseButton: CGMouseButton = button == "right" ? .right : .left

    switch action {
    case "click":
        if let down = CGEvent(mouseEventSource: nil, mouseType: mouseButton == .right ? .rightMouseDown : .leftMouseDown, mouseCursorPosition: point, mouseButton: mouseButton),
           let up = CGEvent(mouseEventSource: nil, mouseType: mouseButton == .right ? .rightMouseUp : .leftMouseUp, mouseCursorPosition: point, mouseButton: mouseButton) {
            down.post(tap: .cghidEventTap)
            usleep(50000)
            up.post(tap: .cghidEventTap)
        }
    case "doubleclick":
        if let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left),
           let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left) {
            down.setIntegerValueField(.mouseEventClickState, value: 2)
            up.setIntegerValueField(.mouseEventClickState, value: 2)
            down.post(tap: .cghidEventTap)
            usleep(50000)
            up.post(tap: .cghidEventTap)
        }
    case "rightclick":
        if let down = CGEvent(mouseEventSource: nil, mouseType: .rightMouseDown, mouseCursorPosition: point, mouseButton: .right),
           let up = CGEvent(mouseEventSource: nil, mouseType: .rightMouseUp, mouseCursorPosition: point, mouseButton: .right) {
            down.post(tap: .cghidEventTap)
            usleep(50000)
            up.post(tap: .cghidEventTap)
        }
    case "move":
        if let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left) {
            move.post(tap: .cghidEventTap)
        }
    case "mousedown":
        if let down = CGEvent(mouseEventSource: nil, mouseType: mouseButton == .right ? .rightMouseDown : .leftMouseDown, mouseCursorPosition: point, mouseButton: mouseButton) {
            down.post(tap: .cghidEventTap)
        }
    case "mouseup":
        if let up = CGEvent(mouseEventSource: nil, mouseType: mouseButton == .right ? .rightMouseUp : .leftMouseUp, mouseCursorPosition: point, mouseButton: mouseButton) {
            up.post(tap: .cghidEventTap)
        }
    default:
        fputs("Unknown mouse action: \(action)\n", stderr)
    }

case "key":
    // key <keyName> <modifiers>
    guard args.count >= 4 else { fputs("Usage: key <keyName> <modifiers>\n", stderr); exit(1) }
    let keyName = args[2]
    let modStr = args[3]

    // Map key names to virtual key codes
    let keyCodeMap: [String: CGKeyCode] = [
        "Enter": 36, "Return": 36, "Tab": 48, "Escape": 53, "Backspace": 51, "Delete": 117,
        "ArrowUp": 126, "ArrowDown": 125, "ArrowLeft": 123, "ArrowRight": 124,
        "Home": 115, "End": 119, "PageUp": 116, "PageDown": 121,
        "Space": 49, " ": 49,
        "F1": 122, "F2": 120, "F3": 99, "F4": 118, "F5": 96, "F6": 97,
        "F7": 98, "F8": 100, "F9": 101, "F10": 109, "F11": 103, "F12": 111,
        "a": 0, "b": 11, "c": 8, "d": 2, "e": 14, "f": 3, "g": 5, "h": 4,
        "i": 34, "j": 38, "k": 40, "l": 37, "m": 46, "n": 45, "o": 31, "p": 35,
        "q": 12, "r": 15, "s": 1, "t": 17, "u": 32, "v": 9, "w": 13, "x": 7,
        "y": 16, "z": 6,
        "0": 29, "1": 18, "2": 19, "3": 20, "4": 21, "5": 23, "6": 22, "7": 26,
        "8": 28, "9": 25,
        "-": 27, "=": 24, "[": 33, "]": 30, "\\": 42, ";": 41, "'": 39,
        ",": 43, ".": 47, "/": 44, "`": 50,
    ]

    let keyCode = keyCodeMap[keyName] ?? keyCodeMap[keyName.lowercased()] ?? 0

    var flags: CGEventFlags = []
    let mods = modStr.split(separator: ",")
    for m in mods {
        switch m {
        case "shift": flags.insert(.maskShift)
        case "control": flags.insert(.maskControl)
        case "option": flags.insert(.maskAlternate)
        case "command": flags.insert(.maskCommand)
        default: break
        }
    }

    if let down = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: true),
       let up = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: false) {
        down.flags = flags
        up.flags = flags
        down.post(tap: .cghidEventTap)
        usleep(30000)
        up.post(tap: .cghidEventTap)
    }

case "scroll":
    // scroll <deltaY> <deltaX>
    guard args.count >= 4 else { fputs("Usage: scroll <deltaY> <deltaX>\n", stderr); exit(1) }
    let deltaY = Int32(args[2]) ?? 0
    let deltaX = Int32(args[3]) ?? 0

    if let scroll = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2, wheel1: deltaY, wheel2: deltaX) {
        scroll.post(tap: .cghidEventTap)
    }

default:
    fputs("Unknown command: \(command)\n", stderr)
    exit(1)
}
