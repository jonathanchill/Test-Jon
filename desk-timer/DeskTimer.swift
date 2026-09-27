// Desk Timer: a plain, always-on-top count-up / count-down timer for macOS.
// Build with ./build.sh (needs the Xcode Command Line Tools).

import AppKit
import SwiftUI

// MARK: - Timer model

enum Mode: String { case up, down }
enum RunState { case idle, running, paused, finished }

@MainActor
final class TimerModel: NSObject, ObservableObject {
    // Settings, remembered between launches. Kept as text so the fields can hold
    // anything while typing; parsed leniently when a run starts.
    @Published var mode: Mode = .down { didSet { save() } }
    @Published var downHours = "1" { didSet { save() } }
    @Published var downMinutes = "0" { didSet { save() } }
    @Published var targetOn = false { didSet { save() } }
    @Published var targetHours = "2" { didSet { save() } }
    @Published var targetMinutes = "0" { didSet { save() } }
    @Published var intervalOn = false { didSet { save() } }
    @Published var intervalMinutes = "30" { didSet { save() } }

    @Published private(set) var state: RunState = .idle
    @Published private(set) var shownSeconds = 0
    @Published private(set) var alarmActive = false

    /// Called when an alarm fires, so the window can bring itself forward.
    var onAlarm: (() -> Void)?

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
        downHours = d.string(forKey: "downHours") ?? downHours
        downMinutes = d.string(forKey: "downMinutes") ?? downMinutes
        targetOn = d.bool(forKey: "targetOn")
        targetHours = d.string(forKey: "targetHours") ?? targetHours
        targetMinutes = d.string(forKey: "targetMinutes") ?? targetMinutes
        intervalOn = d.bool(forKey: "intervalOn")
        intervalMinutes = d.string(forKey: "intervalMinutes") ?? intervalMinutes
        loading = false
    }

    private func save() {
        guard !loading else { return }
        let d = UserDefaults.standard
        d.set(mode.rawValue, forKey: "mode")
        d.set(downHours, forKey: "downHours")
        d.set(downMinutes, forKey: "downMinutes")
        d.set(targetOn, forKey: "targetOn")
        d.set(targetHours, forKey: "targetHours")
        d.set(targetMinutes, forKey: "targetMinutes")
        d.set(intervalOn, forKey: "intervalOn")
        d.set(intervalMinutes, forKey: "intervalMinutes")
    }

    // MARK: Settings as numbers

    private static func number(_ text: String) -> Int {
        Int(String(text.filter { $0.isNumber }.prefix(4))) ?? 0
    }

    var durationSetting: Int { Self.number(downHours) * 3600 + Self.number(downMinutes) * 60 }
    var targetSetting: Int { Self.number(targetHours) * 3600 + Self.number(targetMinutes) * 60 }
    var intervalSetting: Int { Self.number(intervalMinutes) * 60 }

    // MARK: Display

    var displaySeconds: Int {
        if state == .idle { return mode == .down ? durationSetting : 0 }
        return shownSeconds
    }

    var displayText: String { Self.format(displaySeconds) }

    static func format(_ seconds: Int) -> String {
        String(format: "%d:%02d:%02d", seconds / 3600, seconds % 3600 / 60, seconds % 60)
    }

    var statusText: String {
        var parts: [String] = []
        switch state {
        case .paused: parts.append("Paused")
        case .finished: parts.append("Time's up")
        default: break
        }
        if runMode == .down {
            parts.append("counting down from \(Self.format(Int(runDuration)))")
        } else {
            parts.append("counting up")
            if runTarget > 0 { parts.append("alarm at \(Self.format(Int(runTarget)))") }
        }
        if runInterval > 0 { parts.append("beep every \(Int(runInterval / 60)) min") }
        let text = parts.joined(separator: " · ")
        return text.prefix(1).uppercased() + text.dropFirst()
    }

    var primaryLabel: String {
        switch state {
        case .idle, .finished: return "Start"
        case .running: return "Pause"
        case .paused: return "Resume"
        }
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
        if mode == .down && durationSetting == 0 {
            NSSound.beep()
            return
        }
        runMode = mode
        runDuration = TimeInterval(durationSetting)
        runTarget = (mode == .up && targetOn) ? TimeInterval(targetSetting) : 0
        runInterval = intervalOn ? TimeInterval(intervalSetting) : 0
        accumulated = 0
        targetFired = false
        intervalsBeeped = 0
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

enum Look {
    /// Calibri if it's installed (it ships with Microsoft Office), otherwise the
    /// system font. Digits are forced to fixed width so the display doesn't jitter.
    static let family: String? = NSFont(name: "Calibri", size: 12) != nil ? "Calibri" : nil

    static func font(_ size: CGFloat) -> Font {
        if let family { return Font.custom(family, size: size).monospacedDigit() }
        return Font.system(size: size).monospacedDigit()
    }

    static let dim = Color.white.opacity(0.55)
}

struct BoxButton: ButtonStyle {
    var selected = false

    func makeBody(configuration: Configuration) -> some View {
        BoxButtonBody(configuration: configuration, selected: selected)
    }
}

private struct BoxButtonBody: View {
    let configuration: ButtonStyleConfiguration
    let selected: Bool
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        let filled = selected || configuration.isPressed
        configuration.label
            .font(Look.font(15))
            .foregroundColor(filled ? .black : .white)
            .padding(.vertical, 6)
            .padding(.horizontal, 14)
            .frame(minWidth: 84)
            .background(filled ? Color.white : Color.black)
            .overlay(Rectangle().stroke(Color.white, lineWidth: 1))
            .contentShape(Rectangle())
            .opacity(isEnabled ? 1 : 0.35)
    }
}

struct CheckBox: View {
    @Binding var isOn: Bool
    let title: String

    var body: some View {
        Button {
            isOn.toggle()
        } label: {
            HStack(spacing: 8) {
                Rectangle()
                    .fill(isOn ? Color.white : Color.black)
                    .frame(width: 12, height: 12)
                    .overlay(Rectangle().stroke(Color.white, lineWidth: 1))
                Text(title)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .font(Look.font(15))
        .foregroundColor(.white)
    }
}

struct NumberField: View {
    @Binding var text: String

    var body: some View {
        TextField("0", text: $text)
            .textFieldStyle(.plain)
            .font(Look.font(15))
            .foregroundColor(.white)
            .multilineTextAlignment(.center)
            .frame(width: 44)
            .padding(.vertical, 3)
            .overlay(Rectangle().stroke(Look.dim, lineWidth: 1))
    }
}

// MARK: - Views

struct ContentView: View {
    @ObservedObject var model: TimerModel

    var body: some View {
        VStack(spacing: 14) {
            display
            if model.state == .idle {
                SettingsPanel(model: model)
            } else {
                Text(model.statusText)
                    .font(Look.font(13))
                    .foregroundColor(Look.dim)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            HStack(spacing: 10) {
                Button(model.primaryLabel) { model.toggle() }
                    .buttonStyle(BoxButton())
                    .disabled(model.state == .finished)
                Button("Reset") { model.reset() }
                    .buttonStyle(BoxButton())
                    .disabled(model.state == .idle)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 28) // clear of the (transparent) title bar
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }

    /// The big digits. Turns white-on-black into black-on-white while an alarm
    /// is showing; click it (or press Esc) to clear.
    private var display: some View {
        GeometryReader { geo in
            Text(model.displayText)
                .font(Look.font(max(1, min(geo.size.height * 0.85, geo.size.width * 0.28))))
                .foregroundColor(model.alarmActive ? .black : .white)
                .lineLimit(1)
                .minimumScaleFactor(0.2)
                .frame(width: geo.size.width, height: geo.size.height)
                .background(model.alarmActive ? Color.white : Color.black)
                .contentShape(Rectangle())
                .onTapGesture { model.dismissAlarm() }
        }
        .frame(minHeight: 60)
    }
}

struct SettingsPanel: View {
    @ObservedObject var model: TimerModel

    private let labelWidth: CGFloat = 120

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Button("Count up") { model.mode = .up }
                    .buttonStyle(BoxButton(selected: model.mode == .up))
                Button("Count down") { model.mode = .down }
                    .buttonStyle(BoxButton(selected: model.mode == .down))
            }
            if model.mode == .down {
                HStack(spacing: 6) {
                    Text("Length")
                        .padding(.leading, 20)
                        .frame(width: labelWidth, alignment: .leading)
                    NumberField(text: $model.downHours)
                    Text("h")
                    NumberField(text: $model.downMinutes)
                    Text("m")
                }
            } else {
                HStack(spacing: 6) {
                    CheckBox(isOn: $model.targetOn, title: "Alarm at")
                        .frame(width: labelWidth, alignment: .leading)
                    Group {
                        NumberField(text: $model.targetHours)
                        Text("h")
                        NumberField(text: $model.targetMinutes)
                        Text("m")
                    }
                    .opacity(model.targetOn ? 1 : 0.4)
                }
            }
            HStack(spacing: 6) {
                CheckBox(isOn: $model.intervalOn, title: "Beep every")
                    .frame(width: labelWidth, alignment: .leading)
                Group {
                    NumberField(text: $model.intervalMinutes)
                    Text("min")
                }
                .opacity(model.intervalOn ? 1 : 0.4)
            }
        }
        .font(Look.font(15))
        .foregroundColor(.white)
        .frame(maxWidth: .infinity, alignment: .leading)
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
final class AppDelegate: NSObject, NSApplicationDelegate {
    private let model = TimerModel()
    private var panel: TimerPanel!
    private var statusItem: NSStatusItem!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let panel = TimerPanel(
            contentRect: NSRect(x: 0, y: 0, width: 440, height: 300),
            styleMask: [.titled, .closable, .resizable, .fullSizeContentView],
            backing: .buffered, defer: false)
        panel.title = "Desk Timer"
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.backgroundColor = .black
        panel.appearance = NSAppearance(named: .darkAqua)
        panel.isMovableByWindowBackground = true
        panel.isReleasedWhenClosed = false
        panel.minSize = NSSize(width: 260, height: 170)

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
            host.sizingOptions = [.minSize] // don't resize the window as content changes
        }
        panel.contentView = host
        panel.keyHandler = { [weak self] event in self?.handleKey(event) ?? false }

        panel.center()
        panel.setFrameAutosaveName("DeskTimerWindow") // reopen where it was left
        self.panel = panel

        model.onAlarm = { [weak self] in self?.panel.orderFrontRegardless() }

        setUpStatusItem()
        showTimer()
    }

    /// No Dock icon (that's what lets the window sit over full-screen apps), so a
    /// small menu bar icon brings the window back if it's closed, and quits.
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

    /// Space: start / pause / resume. Esc: clear alarm. R: reset. ⌘Q: quit.
    /// There's no menu bar, so the usual editing shortcuts are wired up here too.
    private func handleKey(_ event: NSEvent) -> Bool {
        let mods = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        let key = event.charactersIgnoringModifiers?.lowercased() ?? ""

        if mods.contains(.command) {
            switch key {
            case "q": NSApp.terminate(nil); return true
            case "x": return NSApp.sendAction(#selector(NSText.cut(_:)), to: nil, from: nil)
            case "c": return NSApp.sendAction(#selector(NSText.copy(_:)), to: nil, from: nil)
            case "v": return NSApp.sendAction(#selector(NSText.paste(_:)), to: nil, from: nil)
            case "a": return NSApp.sendAction(#selector(NSText.selectAll(_:)), to: nil, from: nil)
            default: return false
            }
        }
        if !mods.isDisjoint(with: [.control, .option]) { return false }

        // The setting fields only take numbers, so these keys are never needed
        // for typing and work even while a field has the cursor.
        switch event.keyCode {
        case 49: // space
            panel.makeFirstResponder(nil)
            model.toggle()
            return true
        case 53: // escape
            model.dismissAlarm()
            return true
        default:
            if key == "r" {
                panel.makeFirstResponder(nil)
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
