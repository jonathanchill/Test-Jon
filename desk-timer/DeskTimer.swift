// Desk Timer: an always-on-top count-up / count-down timer for macOS,
// drawn as an old-school seven-segment LED clock.
// Build with ./build.sh (needs the Xcode Command Line Tools).

import AppKit
import Combine
import CoreText
import SwiftUI

// MARK: - Timer model

enum Mode: String { case up, down }
enum RunState { case idle, running, paused, finished }
enum EditField { case hours, minutes, interval }

@MainActor
final class TimerModel: NSObject, ObservableObject {
    // Settings, remembered between launches. All in whole minutes.
    @Published var mode: Mode = .down { didSet { save() } }
    @Published var downMinutes = 60 { didSet { save() } }     // countdown length
    @Published var targetOn = false { didSet { save() } }
    @Published var targetMinutes = 120 { didSet { save() } }  // count-up alarm
    @Published var intervalOn = false { didSet { save() } }
    @Published var intervalMinutes = 30 { didSet { save() } }

    @Published private(set) var state: RunState = .idle
    @Published private(set) var shownSeconds = 0
    @Published private(set) var alarmActive = false

    /// Which setup digits are being typed into, and what's been typed so far.
    @Published private(set) var editing: EditField?
    @Published private(set) var editBuffer = ""

    /// Called when an alarm fires, so the window can bring itself forward.
    var onAlarm: (() -> Void)?

    static let maxMinutes = 99 * 60 + 59
    static let maxInterval = 999

    // Values frozen when a run starts.
    private(set) var runMode: Mode = .down
    private(set) var runDuration: TimeInterval = 0 // countdown length
    private(set) var runTarget: TimeInterval = 0   // count-up alarm, 0 = none
    private(set) var runInterval: TimeInterval = 0 // interval beep, 0 = none

    // Elapsed time is measured against the clock, not by counting ticks, so it
    // stays accurate however irregularly the ticker fires.
    private var accumulated: TimeInterval = 0
    private var startedAt: Date?
    private var targetFired = false
    private var intervalsBeeped = 0

    private var ticker: Timer?
    private var chimeTimer: Timer?
    private var chimesLeft = 0
    private var activity: NSObjectProtocol?
    private var loading = false

    private static let alarmSound = "Glass"
    private static let alarmChimes = 4
    private static let intervalSound = "Ping"

    override init() {
        super.init()
        loading = true
        let d = UserDefaults.standard
        if let m = d.string(forKey: "mode").flatMap(Mode.init(rawValue:)) { mode = m }
        if let v = d.object(forKey: "downTotal") as? Int { downMinutes = v }
        if let v = d.object(forKey: "targetTotal") as? Int { targetMinutes = v }
        if let v = d.object(forKey: "intervalTotal") as? Int { intervalMinutes = v }
        targetOn = d.bool(forKey: "targetOn")
        intervalOn = d.bool(forKey: "intervalOn")
        loading = false
    }

    private func save() {
        guard !loading else { return }
        let d = UserDefaults.standard
        d.set(mode.rawValue, forKey: "mode")
        d.set(downMinutes, forKey: "downTotal")
        d.set(targetMinutes, forKey: "targetTotal")
        d.set(intervalMinutes, forKey: "intervalTotal")
        d.set(targetOn, forKey: "targetOn")
        d.set(intervalOn, forKey: "intervalOn")
    }

    // MARK: Setup

    /// The time the big setup digits show: the countdown length, or the
    /// count-up alarm time. Changing the alarm time switches the alarm on.
    var setupMinutes: Int {
        get { mode == .down ? downMinutes : targetMinutes }
        set {
            let v = min(max(newValue, 0), Self.maxMinutes)
            if mode == .down {
                downMinutes = v
            } else {
                targetMinutes = v
                targetOn = true
            }
        }
    }

    func setMode(_ m: Mode) {
        commitEdit()
        mode = m
    }

    func stepHours(_ direction: Int) {
        commitEdit()
        setupMinutes += 60 * direction
    }

    /// Minutes move in 5s; a typed odd value snaps to the next 5 either way.
    func stepMinutes(_ direction: Int) {
        commitEdit()
        let m = setupMinutes
        setupMinutes = direction > 0 ? (m / 5 + 1) * 5 : (m % 5 == 0 ? m - 5 : m / 5 * 5)
    }

    func stepInterval(_ direction: Int) {
        commitEdit()
        let v = intervalMinutes
        let next: Int
        if direction > 0 {
            next = v < 5 ? 5 : (v / 5 + 1) * 5
        } else {
            next = v <= 5 ? v - 1 : (v % 5 == 0 ? v - 5 : v / 5 * 5)
        }
        intervalMinutes = min(max(next, 1), Self.maxInterval)
        intervalOn = true
    }

    // Typing into the digits: click them, type, then Return / Tab / click away.

    func beginEdit(_ field: EditField) {
        commitEdit()
        editing = field
        editBuffer = ""
    }

    func typeDigit(_ c: Character) {
        guard let field = editing else { return }
        let maxLength = field == .interval ? 3 : 2
        if editBuffer.count < maxLength { editBuffer.append(c) }
    }

    func backspace() {
        if !editBuffer.isEmpty { editBuffer.removeLast() }
    }

    func cancelEdit() {
        editing = nil
        editBuffer = ""
    }

    func commitEdit() {
        guard let field = editing else { return }
        if let n = Int(editBuffer) {
            switch field {
            case .hours: setupMinutes = n * 60 + setupMinutes % 60
            case .minutes: setupMinutes = setupMinutes / 60 * 60 + n // 90 min carries into the hour
            case .interval:
                intervalMinutes = min(max(n, 1), Self.maxInterval)
                intervalOn = true
            }
        }
        cancelEdit()
    }

    /// Tab: hours → minutes → done.
    func tabEdit() {
        let next: EditField? = editing == .hours ? .minutes : nil
        commitEdit()
        if let next { beginEdit(next) }
    }

    private func editText(_ field: EditField, width: Int) -> String? {
        guard editing == field else { return nil }
        return String(repeating: " ", count: max(0, width - editBuffer.count)) + editBuffer
    }

    var hoursText: String {
        editText(.hours, width: 2) ?? String(format: "%2d", setupMinutes / 60)
    }

    var minutesText: String {
        editText(.minutes, width: 2) ?? String(format: "%02d", setupMinutes % 60)
    }

    var intervalText: String {
        editText(.interval, width: 3) ?? String(format: "%3d", intervalMinutes)
    }

    // MARK: Display

    var displayText: String { Self.format(shownSeconds) }

    static func format(_ seconds: Int) -> String {
        String(format: "%d:%02d:%02d", seconds / 3600, seconds % 3600 / 60, seconds % 60)
    }

    /// The small line under the display, bottom left.
    var statusLine: String {
        if alarmActive { return "CLICK OR ESC TO SILENCE" }
        if state == .finished { return "TIME UP" }
        if runMode == .down { return "FROM " + Self.format(Int(runDuration)) }
        if runTarget > 0 { return "ALARM AT " + Self.format(Int(runTarget)) }
        return "COUNTING UP"
    }

    /// The indicator lamps under the digits: label and whether it's lit.
    var indicators: [(String, Bool)] {
        let beep = runInterval > 0 ? "BEEP \(Int(runInterval / 60))" : "BEEP"
        let last = (alarmActive || state == .finished) ? "TIME UP" : "PAUSED"
        return [
            ("▼ DOWN", runMode == .down),
            ("▲ UP", runMode == .up),
            ("ALARM", runTarget > 0),
            (beep, runInterval > 0),
            (last, state == .paused || alarmActive || state == .finished),
        ]
    }

    // MARK: Controls

    /// Start / pause / resume; after a countdown finishes, resets.
    func toggle() {
        switch state {
        case .idle: start()
        case .running: pause()
        case .paused: run()
        case .finished: reset()
        }
    }

    func start() {
        guard state == .idle else { return }
        commitEdit()
        if mode == .down && downMinutes == 0 {
            NSSound.beep()
            return
        }
        runMode = mode
        runDuration = TimeInterval(downMinutes * 60)
        runTarget = (mode == .up && targetOn && targetMinutes > 0) ? TimeInterval(targetMinutes * 60) : 0
        runInterval = intervalOn ? TimeInterval(intervalMinutes * 60) : 0
        accumulated = 0
        targetFired = false
        intervalsBeeped = 0
        shownSeconds = mode == .down ? Int(runDuration) : 0
        run()
    }

    func pause() {
        guard state == .running else { return }
        accumulated = elapsed
        startedAt = nil
        state = .paused
        stopTicker()
    }

    func reset() {
        stopTicker()
        dismissAlarm()
        startedAt = nil
        accumulated = 0
        shownSeconds = 0
        state = .idle
    }

    func dismissAlarm() {
        alarmActive = false
        chimeTimer?.invalidate()
        chimeTimer = nil
    }

    // MARK: Running

    private var elapsed: TimeInterval {
        accumulated + (startedAt.map { Date().timeIntervalSince($0) } ?? 0)
    }

    private func run() {
        startedAt = Date()
        state = .running
        let t = Timer(timeInterval: 0.1, target: self, selector: #selector(tick),
                      userInfo: nil, repeats: true)
        t.tolerance = 0.02
        RunLoop.main.add(t, forMode: .common)
        ticker = t
        // Stop macOS throttling the timer (App Nap) or idle-sleeping mid-session.
        if activity == nil {
            activity = ProcessInfo.processInfo.beginActivity(
                options: .userInitiated, reason: "Desk Timer is running")
        }
        tick()
    }

    private func stopTicker() {
        ticker?.invalidate()
        ticker = nil
        if let a = activity {
            ProcessInfo.processInfo.endActivity(a)
            activity = nil
        }
    }

    private func show(_ seconds: Int) {
        if shownSeconds != seconds { shownSeconds = seconds }
    }

    @objc private func tick() {
        guard state == .running else { return }
        let e = elapsed

        if runMode == .down {
            let remaining = runDuration - e
            if remaining <= 0 {
                accumulated = runDuration
                startedAt = nil
                show(0)
                state = .finished
                stopTicker()
                fireAlarm()
                return
            }
            show(Int(remaining.rounded(.up)))
        } else {
            show(Int(e))
            if runTarget > 0 && !targetFired && e >= runTarget {
                targetFired = true
                // Don't also play an interval beep on top of the alarm.
                if runInterval > 0 { intervalsBeeped = Int(e / runInterval) }
                fireAlarm()
                return
            }
        }

        if runInterval > 0 {
            let n = Int(e / runInterval)
            if n > intervalsBeeped {
                intervalsBeeped = n
                play(Self.intervalSound)
            }
        }
    }

    // MARK: Sound

    private func fireAlarm() {
        dismissAlarm()
        alarmActive = true
        chimesLeft = Self.alarmChimes
        chime()
        let t = Timer(timeInterval: 1.3, target: self, selector: #selector(chime),
                      userInfo: nil, repeats: true)
        RunLoop.main.add(t, forMode: .common)
        chimeTimer = t
        onAlarm?()
    }

    @objc private func chime() {
        guard alarmActive, chimesLeft > 0 else {
            chimeTimer?.invalidate()
            chimeTimer = nil
            return
        }
        chimesLeft -= 1
        play(Self.alarmSound)
    }

    private func play(_ name: String) {
        guard let sound = NSSound(named: NSSound.Name(name)) else {
            NSSound.beep()
            return
        }
        sound.stop()
        sound.play()
    }
}

// MARK: - Look

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255)
    }
}

enum Theme {
    static let lit = Color(hex: 0xF4F4F0)        // lit segments, selected keys
    static let ghost = Color.white.opacity(0.07) // unlit segments
    static let glow = Color.white.opacity(0.30)
    static let lampOff = Color.white.opacity(0.18)
    static let text = Color(hex: 0xE8E8E4)
    static let dim = Color(hex: 0x8C8C88)
    static let hint = Color(hex: 0x6E6E6A)
    static let panel = Color(hex: 0x060606)
    static let panelBorder = Color(hex: 0x1C1C1C)
    static let key = Color(hex: 0x0D0D0D)
    static let keyPressed = Color(hex: 0x1A1A1A)
    static let keyBorder = Color(hex: 0x2E2E2E)
    static let ink = Color(hex: 0x0A0A0A)        // digits on the lit alarm panel

    /// Share Tech Mono ships inside the app (Contents/Resources); Menlo if it's missing.
    static let labelFontName: String = {
        if let url = Bundle.main.url(forResource: "ShareTechMono-Regular", withExtension: "ttf") {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
        return NSFont(name: "ShareTechMono-Regular", size: 12) != nil ? "ShareTechMono-Regular" : "Menlo"
    }()

    static func font(_ size: CGFloat) -> Font { Font.custom(labelFontName, size: size) }
}

// MARK: - Seven-segment digits

// Shapes in design units: a digit cell is 70 × 104, a colon cell 24 × 104,
// everything slanted 5° like a real LED clock face.
private func points(_ v: [CGFloat]) -> [CGPoint] {
    stride(from: 0, to: v.count, by: 2).map { CGPoint(x: v[$0], y: v[$0 + 1]) }
}

private let segmentShapes: [(Character, [CGPoint])] = [
    ("a", points([8, 6, 13, 1, 47, 1, 52, 6, 47, 11, 13, 11])),
    ("b", points([54, 8, 59, 13, 59, 45, 54, 50, 49, 45, 49, 13])),
    ("c", points([54, 54, 59, 59, 59, 91, 54, 96, 49, 91, 49, 59])),
    ("d", points([8, 98, 13, 93, 47, 93, 52, 98, 47, 103, 13, 103])),
    ("e", points([6, 54, 11, 59, 11, 91, 6, 96, 1, 91, 1, 59])),
    ("f", points([6, 8, 11, 13, 11, 45, 6, 50, 1, 45, 1, 13])),
    ("g", points([8, 52, 13, 47, 47, 47, 52, 52, 47, 57, 13, 57])),
]

private let colonDots: [[CGPoint]] = [
    points([7, 29, 17, 29, 17, 39, 7, 39]),
    points([7, 67, 17, 67, 17, 77, 7, 77]),
]

private let digitSegments: [Character: String] = [
    "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc",
    "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg",
    "-": "g", " ": "",
]

private let slant: CGFloat = 0.0875 // tan 5°

/// Draws text ("1:23:45", " 1", "30") as seven-segment digits, as large as fits,
/// centred. Unlit segments show faintly behind the lit ones.
struct SegmentText: View {
    let text: String
    var lit: Color = Theme.lit
    var ghost: Color = Theme.ghost
    var glow: Color? = Theme.glow
    var colonOn = true

    static func gap(_ h: CGFloat) -> CGFloat { max(2, (h * 0.05).rounded()) }

    static func width(of text: String, height h: CGFloat) -> CGFloat {
        let s = h / 104
        var cells: CGFloat = 0
        for ch in text { cells += (ch == ":" ? CGFloat(24) : CGFloat(70)) * s }
        return cells + gap(h) * CGFloat(max(0, text.count - 1))
    }

    static func fittingHeight(for text: String, in size: CGSize) -> CGFloat {
        guard !text.isEmpty, size.width > 0, size.height > 0 else { return 0 }
        var h = min(size.height, size.width / (width(of: text, height: 100) / 100))
        while h > 1 && width(of: text, height: h) > size.width { h -= 1 }
        return max(h, 0)
    }

    var body: some View {
        GeometryReader { geo in
            let h = Self.fittingHeight(for: text, in: geo.size)
            Canvas { ctx, size in
                Self.draw(text, height: h, in: size, context: &ctx,
                          lit: lit, ghost: ghost, colonOn: colonOn)
            }
            .shadow(color: glow ?? .clear, radius: glow == nil ? 0 : max(2, h * 0.07))
        }
        .accessibilityElement()
        .accessibilityLabel(text.trimmingCharacters(in: .whitespaces))
    }

    private static func draw(_ text: String, height h: CGFloat, in size: CGSize,
                             context ctx: inout GraphicsContext,
                             lit: Color, ghost: Color, colonOn: Bool) {
        let s = h / 104
        let gap = Self.gap(h)
        var x = (size.width - width(of: text, height: h)) / 2
        let y = (size.height - h) / 2
        for ch in text {
            if ch == ":" {
                for dot in colonDots {
                    ctx.fill(shape(dot, x: x, y: y, scale: s, pad: 6), with: .color(colonOn ? lit : ghost))
                }
                x += 24 * s + gap
            } else {
                let on = digitSegments[ch] ?? ""
                for (name, pts) in segmentShapes {
                    ctx.fill(shape(pts, x: x, y: y, scale: s, pad: 10),
                             with: .color(on.contains(name) ? lit : ghost))
                }
                x += 70 * s + gap
            }
        }
    }

    private static func shape(_ pts: [CGPoint], x: CGFloat, y: CGFloat,
                              scale s: CGFloat, pad: CGFloat) -> Path {
        var path = Path()
        for (i, p) in pts.enumerated() {
            let q = CGPoint(x: x + (p.x - slant * p.y + pad) * s, y: y + p.y * s)
            if i == 0 { path.move(to: q) } else { path.addLine(to: q) }
        }
        path.closeSubpath()
        return path
    }
}

// MARK: - Controls

/// The hardware-style keys: dark with a thin border, or filled white.
struct KeyStyle: ButtonStyle {
    var filled = false
    var height: CGFloat = 40
    var width: CGFloat? = nil
    var fullWidth = false
    var fontSize: CGFloat = 13

    func makeBody(configuration: Configuration) -> some View {
        KeyBody(configuration: configuration, style: self)
    }
}

private struct KeyBody: View {
    let configuration: ButtonStyleConfiguration
    let style: KeyStyle
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        let pressed = configuration.isPressed
        let fill: Color = style.filled
            ? (pressed ? Color(hex: 0xCFCFCB) : Theme.lit)
            : (pressed ? Theme.keyPressed : Theme.key)
        let border: Color = style.filled ? Theme.lit : (isEnabled ? Theme.keyBorder : Color(hex: 0x1E1E1E))
        let fg: Color = !isEnabled ? Color(hex: 0x5A5A58) : (style.filled ? .black : Theme.text)
        configuration.label
            .font(Theme.font(style.fontSize))
            .foregroundColor(fg)
            .padding(.horizontal, style.width == nil && !style.fullWidth ? 20 : 0)
            .frame(width: style.width, height: style.height)
            .frame(maxWidth: style.fullWidth ? .infinity : nil)
            .background(RoundedRectangle(cornerRadius: 6).fill(fill))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(border, lineWidth: 1))
            .contentShape(Rectangle())
    }
}

/// One half of the COUNT DOWN / COUNT UP switch.
private struct ModeStyle: ButtonStyle {
    let selected: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.font(13))
            .foregroundColor(selected ? .black : Theme.dim)
            .frame(maxWidth: .infinity, minHeight: 44, maxHeight: 44)
            .background(selected ? Theme.lit : (configuration.isPressed ? Theme.keyPressed : Theme.key))
            .contentShape(Rectangle())
    }
}

/// A square-cornered slide switch.
struct SlideSwitch: View {
    @Binding var isOn: Bool
    let label: String

    var body: some View {
        Button {
            isOn.toggle()
        } label: {
            ZStack(alignment: isOn ? Alignment.trailing : Alignment.leading) {
                RoundedRectangle(cornerRadius: 4).fill(isOn ? Theme.lit : Color(hex: 0x141414))
                RoundedRectangle(cornerRadius: 4).stroke(isOn ? Theme.lit : Color(hex: 0x3A3A3A), lineWidth: 1)
                RoundedRectangle(cornerRadius: 2)
                    .fill(isOn ? Color.black : Color(hex: 0x6A6A66))
                    .frame(width: 16, height: 16)
                    .padding(3)
            }
            .frame(width: 44, height: 24)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityValue(isOn ? "On" : "Off")
    }
}

extension View {
    /// The recessed dark display panel.
    func panel(_ fill: Color = Theme.panel, border: Color = Theme.panelBorder) -> some View {
        background(RoundedRectangle(cornerRadius: 8).fill(fill))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(border, lineWidth: 1))
    }
}

private func caps(_ s: String, tracking: CGFloat = 3) -> Text {
    Text(s).tracking(tracking)
}

// MARK: - Running screen

struct RunView: View {
    @ObservedObject var model: TimerModel

    var body: some View {
        VStack(spacing: 14) {
            display
            HStack(spacing: 12) {
                caps(model.statusLine, tracking: 2)
                    .font(Theme.font(12))
                    .foregroundColor(Theme.dim)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 0)
                primaryKey
                Button { model.reset() } label: { caps("RESET") }
                    .buttonStyle(KeyStyle())
            }
        }
    }

    @ViewBuilder private var primaryKey: some View {
        switch model.state {
        case .running:
            Button { model.pause() } label: { caps("PAUSE") }.buttonStyle(KeyStyle())
        case .paused:
            Button { model.toggle() } label: { caps("RESUME") }.buttonStyle(KeyStyle(filled: true))
        default:
            Button {} label: { caps("START") }.buttonStyle(KeyStyle()).disabled(true)
        }
    }

    /// The digits and indicator lamps. While an alarm is showing the panel lights
    /// up white with black digits; clicking it (or Esc) silences it.
    private var display: some View {
        let alarm = model.alarmActive
        let paused = model.state == .paused
        return VStack(spacing: 16) {
            SegmentText(text: model.displayText,
                        lit: alarm ? Theme.ink : Theme.lit,
                        ghost: alarm ? Color.black.opacity(0.08) : Theme.ghost,
                        glow: (alarm || paused) ? nil : Theme.glow,
                        colonOn: !paused)
                .opacity(paused ? 0.5 : 1)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            HStack(spacing: 22) {
                ForEach(model.indicators.indices, id: \.self) { i in
                    let lamp = model.indicators[i]
                    caps(lamp.0, tracking: 2)
                        .foregroundColor(lamp.1 ? (alarm ? Theme.ink : Theme.lit)
                                                : (alarm ? Color.black.opacity(0.2) : Theme.lampOff))
                        .lineLimit(1)
                }
            }
            .font(Theme.font(12))
            .minimumScaleFactor(0.6)
        }
        .padding(16)
        .panel(alarm ? Theme.lit : Theme.panel, border: alarm ? Theme.lit : Theme.panelBorder)
        .shadow(color: alarm ? Theme.glow : .clear, radius: 20)
        .contentShape(Rectangle())
        .onTapGesture { model.dismissAlarm() }
    }
}

// MARK: - Setup screen

struct SetupView: View {
    @ObservedObject var model: TimerModel

    private let bigDigits: CGFloat = 96
    private let smallDigits: CGFloat = 30

    var body: some View {
        VStack(spacing: 16) {
            modeSwitch
            timePanel
            beepRow
            Button { model.start() } label: { caps("START", tracking: 6) }
                .buttonStyle(KeyStyle(filled: true, height: 52, fullWidth: true, fontSize: 16))
        }
        .contentShape(Rectangle())
        .onTapGesture { model.commitEdit() } // clicking away finishes typing
    }

    private var modeSwitch: some View {
        HStack(spacing: 0) {
            Button { model.setMode(.down) } label: { caps("▼ COUNT DOWN") }
                .buttonStyle(ModeStyle(selected: model.mode == .down))
            Rectangle().fill(Theme.keyBorder).frame(width: 1, height: 44)
            Button { model.setMode(.up) } label: { caps("▲ COUNT UP") }
                .buttonStyle(ModeStyle(selected: model.mode == .up))
        }
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.keyBorder, lineWidth: 1))
    }

    private var timePanel: some View {
        let countUp = model.mode == .up
        return VStack(spacing: 10) {
            HStack {
                if countUp {
                    SlideSwitch(isOn: $model.targetOn, label: "Alarm at")
                    caps("ALARM AT", tracking: 2).foregroundColor(Theme.text).padding(.leading, 4)
                } else {
                    caps("LENGTH", tracking: 2)
                }
                Spacer()
                caps("HRS : MIN", tracking: 2)
            }
            .font(Theme.font(12))
            .foregroundColor(Theme.dim)

            HStack(spacing: 12) {
                digitColumn(.hours, text: model.hoursText,
                            up: { model.stepHours(1) }, down: { model.stepHours(-1) },
                            upLabel: "Add an hour", downLabel: "Remove an hour")
                SegmentText(text: ":")
                    .frame(width: SegmentText.width(of: ":", height: bigDigits), height: bigDigits)
                digitColumn(.minutes, text: model.minutesText,
                            up: { model.stepMinutes(1) }, down: { model.stepMinutes(-1) },
                            upLabel: "Add 5 minutes", downLabel: "Remove 5 minutes")
            }
            .opacity(countUp && !model.targetOn ? 0.4 : 1)

            caps(countUp ? "SOUNDS ONCE · THE CLOCK KEEPS COUNTING"
                          : "CLICK THE DIGITS TO TYPE · UP TO 99 HOURS", tracking: 2)
                .font(Theme.font(11))
                .foregroundColor(Theme.hint)
        }
        .padding(.vertical, 16)
        .padding(.horizontal, 20)
        .panel()
    }

    private func digitColumn(_ field: EditField, text: String,
                             up: @escaping () -> Void, down: @escaping () -> Void,
                             upLabel: String, downLabel: String) -> some View {
        VStack(spacing: 8) {
            Button(action: up) { Image(systemName: "chevron.up") }
                .buttonStyle(KeyStyle(height: 28, width: 120))
                .accessibilityLabel(upLabel)
            editableDigits(field, text: text, height: bigDigits, sample: "88")
            Button(action: down) { Image(systemName: "chevron.down") }
                .buttonStyle(KeyStyle(height: 28, width: 120))
                .accessibilityLabel(downLabel)
        }
    }

    /// Digits you can click to type into; a bar underneath shows which is active.
    private func editableDigits(_ field: EditField, text: String,
                                height: CGFloat, sample: String) -> some View {
        let active = model.editing == field
        return SegmentText(text: text)
            .frame(width: SegmentText.width(of: sample, height: height), height: height)
            .padding(.bottom, 6)
            .overlay(Rectangle()
                        .fill(active ? Theme.lit : Color.clear)
                        .frame(height: 2),
                     alignment: .bottom)
            .contentShape(Rectangle())
            .onTapGesture { model.beginEdit(field) }
    }

    private var beepRow: some View {
        HStack(spacing: 14) {
            SlideSwitch(isOn: $model.intervalOn, label: "Beep every")
            caps("BEEP EVERY")
                .font(Theme.font(13))
                .foregroundColor(model.intervalOn ? Theme.text : Theme.dim)
            Spacer(minLength: 0)
            HStack(spacing: 14) {
                Button { model.stepInterval(-1) } label: { Image(systemName: "minus") }
                    .buttonStyle(KeyStyle(height: 32, width: 32))
                    .accessibilityLabel("Shorter interval")
                editableDigits(.interval, text: model.intervalText, height: smallDigits, sample: "888")
                caps("MIN", tracking: 2)
                    .font(Theme.font(12))
                    .foregroundColor(Theme.dim)
                Button { model.stepInterval(1) } label: { Image(systemName: "plus") }
                    .buttonStyle(KeyStyle(height: 32, width: 32))
                    .accessibilityLabel("Longer interval")
            }
            .opacity(model.intervalOn ? 1 : 0.4)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 16)
        .panel()
    }
}

// MARK: - Window content

struct ContentView: View {
    @ObservedObject var model: TimerModel

    var body: some View {
        Group {
            if model.state == .idle {
                SetupView(model: model)
            } else {
                RunView(model: model)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 34) // clear of the (transparent) title bar
        .padding(.bottom, 20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }
}

// MARK: - Window

/// Clicks land on the timer's buttons straight away, even while another app
/// (Ableton, Logic) has focus, instead of the first click only focusing the window.
final class FirstClickHostingView<Content: View>: NSHostingView<Content> {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

final class TimerPanel: NSPanel {
    var keyHandler: ((NSEvent) -> Bool)?

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }

    override func sendEvent(_ event: NSEvent) {
        if event.type == .keyDown, let keyHandler, keyHandler(event) { return }
        super.sendEvent(event)
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private let model = TimerModel()
    private var panel: TimerPanel!
    private var statusItem: NSStatusItem!
    private var cancellables = Set<AnyCancellable>()
    private var showingSetup: Bool?

    // Setup and running screens each keep their own window size.
    private static let setupSize = NSSize(width: 560, height: 530)
    private static let runSize = NSSize(width: 560, height: 300)

    func applicationDidFinishLaunching(_ notification: Notification) {
        let panel = TimerPanel(
            contentRect: NSRect(origin: .zero, size: Self.setupSize),
            styleMask: [.titled, .closable, .resizable, .fullSizeContentView],
            backing: .buffered, defer: false)
        panel.title = "Desk Timer"
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.backgroundColor = .black
        panel.appearance = NSAppearance(named: .darkAqua)
        panel.isMovableByWindowBackground = true
        panel.isReleasedWhenClosed = false
        panel.delegate = self

        // The always-on-top part:
        //  - status-bar level sits above normal windows *and* other apps' floating
        //    windows (e.g. plug-in windows), so clicking into the DAW can't cover it;
        //  - panels hide when their app loses focus by default: switch that off;
        //  - show on every Space, including over full-screen apps.
        panel.level = .statusBar
        panel.hidesOnDeactivate = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

        let host = FirstClickHostingView(rootView: ContentView(model: model))
        if #available(macOS 13.0, *) {
            host.sizingOptions = [] // the window sizes itself per screen, below
        }
        panel.contentView = host
        panel.keyHandler = { [weak self] event in self?.handleKey(event) ?? false }

        panel.center()
        panel.setFrameAutosaveName("DeskTimerWindow") // reopen where it was left
        self.panel = panel

        model.onAlarm = { [weak self] in self?.panel.orderFrontRegardless() }
        model.$state
            .map { $0 == .idle }
            .removeDuplicates()
            .sink { [weak self] idle in self?.switchLayout(toSetup: idle) }
            .store(in: &cancellables)

        setUpStatusItem()
        showTimer()
    }

    /// Resize between the tall setup screen and the short running screen, keeping
    /// the window's top-left corner where it is. Each remembers its own size.
    private func switchLayout(toSetup setup: Bool) {
        rememberSize()
        showingSetup = setup
        panel.contentMinSize = setup ? NSSize(width: 480, height: 510) : NSSize(width: 420, height: 180)
        let stored = UserDefaults.standard.string(forKey: setup ? "setupSize" : "runSize")
        let content = stored.map(NSSizeFromString) ?? (setup ? Self.setupSize : Self.runSize)
        let size = panel.frameRect(forContentRect: NSRect(origin: .zero, size: content)).size
        let old = panel.frame
        let frame = NSRect(x: old.minX, y: old.maxY - size.height, width: size.width, height: size.height)
        panel.setFrame(frame, display: true, animate: panel.isVisible)
    }

    private func rememberSize() {
        guard let setup = showingSetup else { return }
        let content = panel.contentRect(forFrameRect: panel.frame).size
        UserDefaults.standard.set(NSStringFromSize(content), forKey: setup ? "setupSize" : "runSize")
    }

    /// No Dock icon (that's what lets the window sit over full-screen apps), so a
    /// small menu bar icon can bring the window forward, and quits.
    private func setUpStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            let image = NSImage(systemSymbolName: "timer", accessibilityDescription: "Desk Timer")
            image?.isTemplate = true
            button.image = image
        }
        let menu = NSMenu()
        let show = menu.addItem(withTitle: "Show Timer", action: #selector(showTimer), keyEquivalent: "")
        show.target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Desk Timer",
                     action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        statusItem.menu = menu
    }

    @objc private func showTimer() {
        panel.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // The close button quits the app. With no Dock icon, a closed window would
    // otherwise leave the app running with nothing on screen.
    func windowWillClose(_ notification: Notification) {
        NSApp.terminate(nil)
    }

    func applicationWillTerminate(_ notification: Notification) {
        rememberSize()
    }

    /// Space: start / pause / resume. Esc: clear alarm. R: reset. ⌘Q: quit.
    /// While typing into the setup digits: 0–9, Delete, Tab, Return, Esc.
    private func handleKey(_ event: NSEvent) -> Bool {
        let mods = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        let key = event.charactersIgnoringModifiers?.lowercased() ?? ""

        if mods.contains(.command) {
            if key == "q" {
                NSApp.terminate(nil)
                return true
            }
            return false
        }
        if !mods.isDisjoint(with: [.control, .option]) { return false }

        if model.editing != nil {
            switch event.keyCode {
            case 36, 76: model.commitEdit()                  // Return, Enter
            case 48: model.tabEdit()                         // Tab
            case 51, 117: model.backspace()                  // Delete
            case 53: model.cancelEdit()                      // Esc
            case 49: model.commitEdit(); model.toggle()      // Space
            default:
                if let c = event.characters?.first, ("0"..."9").contains(c) {
                    model.typeDigit(c)
                }
            }
            return true
        }

        switch event.keyCode {
        case 49: // Space
            model.toggle()
            return true
        case 36, 76: // Return starts from the setup screen
            if model.state == .idle { model.start() }
            return true
        case 53: // Esc
            model.dismissAlarm()
            return true
        default:
            if key == "r" {
                model.reset()
                return true
            }
            return false
        }
    }
}

@main
@MainActor
enum DeskTimerApp {
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        app.run()
    }
}
