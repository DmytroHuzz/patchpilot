import AppKit
import AVFoundation
import CoreVideo
import Foundation

struct Slide {
    let path: String
    let eyebrow: String
    let title: String
    let subtitle: String
}

struct NarrationManifest: Decodable {
    let provider: String
    let voice: String
    let rate: String
    let clips: [String]
}

enum RenderError: Error, CustomStringConvertible {
    case badArguments
    case missingAsset(String)
    case imageDecode(String)
    case pixelBuffer
    case writer(String)
    case missingTrack(String)
    case export(String)

    var description: String {
        switch self {
        case .badArguments:
            return "Usage: render-demo-video.swift <repository-root> <narration-manifest.json> <output.mp4>"
        case .missingAsset(let path):
            return "Missing render asset: \(path)"
        case .imageDecode(let path):
            return "Could not decode image: \(path)"
        case .pixelBuffer:
            return "Could not allocate a video pixel buffer"
        case .writer(let message):
            return "Video writer failed: \(message)"
        case .missingTrack(let kind):
            return "Rendered asset has no \(kind) track"
        case .export(let message):
            return "MP4 export failed: \(message)"
        }
    }
}

let width = 1280
let height = 720
let framesPerSecond: Int32 = 30
let introSeconds = 1.0
let interSlideLeadSeconds = 0.25
let interSlideTailSeconds = 0.45
let outroSeconds = 1.5

func removeGeneratedFile(_ url: URL) throws {
    let manager = FileManager.default
    if manager.fileExists(atPath: url.path) {
        try manager.removeItem(at: url)
    }
}

func captionedImage(slide: Slide) throws -> CGImage {
    guard FileManager.default.fileExists(atPath: slide.path) else {
        throw RenderError.missingAsset(slide.path)
    }
    guard let source = NSImage(contentsOfFile: slide.path) else {
        throw RenderError.imageDecode(slide.path)
    }

    let canvas = NSImage(size: NSSize(width: width, height: height))
    canvas.lockFocus()
    source.draw(
        in: NSRect(x: 0, y: 0, width: width, height: height),
        from: NSRect(origin: .zero, size: source.size),
        operation: .copy,
        fraction: 1
    )

    NSColor(calibratedWhite: 0.015, alpha: 0.9).setFill()
    NSBezierPath(rect: NSRect(x: 0, y: 0, width: width, height: 106)).fill()
    NSColor(calibratedRed: 0.36, green: 0.94, blue: 0.67, alpha: 1).setFill()
    NSBezierPath(rect: NSRect(x: 0, y: 0, width: 12, height: 106)).fill()

    let eyebrowStyle: [NSAttributedString.Key: Any] = [
        .font: NSFont.monospacedSystemFont(ofSize: 13, weight: .semibold),
        .foregroundColor: NSColor(calibratedRed: 0.36, green: 0.94, blue: 0.67, alpha: 1),
        .kern: 1.6,
    ]
    let titleStyle: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: 29, weight: .bold),
        .foregroundColor: NSColor.white,
    ]
    let subtitleStyle: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: 16, weight: .regular),
        .foregroundColor: NSColor(calibratedWhite: 0.78, alpha: 1),
    ]

    (slide.eyebrow.uppercased() as NSString).draw(at: NSPoint(x: 42, y: 76), withAttributes: eyebrowStyle)
    (slide.title as NSString).draw(at: NSPoint(x: 42, y: 39), withAttributes: titleStyle)
    (slide.subtitle as NSString).draw(at: NSPoint(x: 42, y: 13), withAttributes: subtitleStyle)
    canvas.unlockFocus()

    var rect = NSRect(x: 0, y: 0, width: width, height: height)
    guard let image = canvas.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
        throw RenderError.imageDecode(slide.path)
    }
    return image
}

func makePixelBuffer(from image: CGImage) throws -> CVPixelBuffer {
    var buffer: CVPixelBuffer?
    let attributes: [CFString: Any] = [
        kCVPixelBufferCGImageCompatibilityKey: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey: true,
        kCVPixelBufferIOSurfacePropertiesKey: [:],
    ]
    let status = CVPixelBufferCreate(
        kCFAllocatorDefault,
        width,
        height,
        kCVPixelFormatType_32BGRA,
        attributes as CFDictionary,
        &buffer
    )
    guard status == kCVReturnSuccess, let buffer else {
        throw RenderError.pixelBuffer
    }

    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let baseAddress = CVPixelBufferGetBaseAddress(buffer) else {
        throw RenderError.pixelBuffer
    }
    guard let context = CGContext(
        data: baseAddress,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
    ) else {
        throw RenderError.pixelBuffer
    }
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return buffer
}

@main
struct PatchPilotVideoRenderer {
    static func main() async throws {
        guard CommandLine.arguments.count == 4 else {
            throw RenderError.badArguments
        }

        let root = CommandLine.arguments[1]
        let manifestURL = URL(fileURLWithPath: CommandLine.arguments[2])
        let outputURL = URL(fileURLWithPath: CommandLine.arguments[3])
        let silentURL = outputURL.deletingLastPathComponent().appendingPathComponent("patchpilot-demo-silent.mov")

        let slides = [
            Slide(path: "\(root)/submission/video-frames/00-ready.jpg", eyebrow: "PatchPilot", title: "Facts first. Judgment second.", subtitle: "One alert becomes a human-reviewed, evidence-backed fix."),
            Slide(path: "\(root)/submission/video-frames/01-detect.jpg", eyebrow: "01 · Detect", title: "A real OSV finding", subtitle: "json5 1.0.1 · GHSA-9c47-m6qq-7p4h · deterministic scanner facts"),
            Slide(path: "\(root)/docs/assets/patchpilot-investigation.jpg", eyebrow: "02 · Investigate", title: "Repository evidence, then interpretation", subtitle: "Exact lines and uncertainty stay visible beside GPT-5.6 output."),
            Slide(path: "\(root)/submission/video-frames/04-approved.jpg", eyebrow: "03 · Approve", title: "No write before the exact plan", subtitle: "Version, four files, commands, test, risks, and rollback are approval-bound."),
            Slide(path: "\(root)/submission/video-frames/05-isolated.jpg", eyebrow: "04 · Isolate", title: "Clean source. Separate runway.", subtitle: "A dedicated patchpilot/run-* worktree contains every write."),
            Slide(path: "\(root)/submission/video-frames/06-patch.jpg", eyebrow: "05–07 · Patch and test", title: "Small diff. Benign regression.", subtitle: "Dependency update, one bounded repair, one safe targeted test."),
            Slide(path: "\(root)/submission/video-frames/08-report.jpg", eyebrow: "08 · Verify and rescan", title: "Before. After. Gone.", subtitle: "Eight command facts pass; the selected advisory is absent."),
            Slide(path: "\(root)/submission/video-frames/09-handoff.jpg", eyebrow: "09 · Report", title: "Facts. Judgment. Approval. Unknowns.", subtitle: "Markdown and JSON preserve the complete accepted evidence chain."),
            Slide(path: "\(root)/docs/assets/patchpilot-handoff.jpg", eyebrow: "10 · Handoff", title: "Committed locally. Publication locked.", subtitle: "Exactly four files; no push, pull request, or merge command ran."),
        ]

        guard FileManager.default.fileExists(atPath: manifestURL.path) else {
            throw RenderError.missingAsset(manifestURL.path)
        }
        let manifest = try JSONDecoder().decode(NarrationManifest.self, from: Data(contentsOf: manifestURL))
        guard manifest.clips.count == slides.count else {
            throw RenderError.missingTrack("one narration clip per slide")
        }

        let narrationDirectory = manifestURL.deletingLastPathComponent()
        var clipAssets: [AVURLAsset] = []
        var clipTracks: [AVAssetTrack] = []
        var clipDurations: [CMTime] = []
        for clip in manifest.clips {
            let clipURL = narrationDirectory.appendingPathComponent(clip)
            guard FileManager.default.fileExists(atPath: clipURL.path) else {
                throw RenderError.missingAsset(clipURL.path)
            }
            let asset = AVURLAsset(url: clipURL)
            let duration = try await asset.load(.duration)
            guard let track = try await asset.loadTracks(withMediaType: .audio).first else {
                throw RenderError.missingTrack("audio in \(clip)")
            }
            clipAssets.append(asset)
            clipTracks.append(track)
            clipDurations.append(duration)
        }

        try removeGeneratedFile(silentURL)
        try removeGeneratedFile(outputURL)

        let writer = try AVAssetWriter(outputURL: silentURL, fileType: .mov)
        let videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: 5_000_000,
                AVVideoMaxKeyFrameIntervalKey: 30,
            ],
        ]
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        input.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                kCVPixelBufferWidthKey as String: width,
                kCVPixelBufferHeightKey as String: height,
            ]
        )
        guard writer.canAdd(input) else {
            throw RenderError.writer("video input is unsupported")
        }
        writer.add(input)
        guard writer.startWriting() else {
            throw RenderError.writer(writer.error?.localizedDescription ?? "could not start")
        }
        writer.startSession(atSourceTime: .zero)

        var frameIndex: Int64 = 0
        var clipStartSeconds: [Double] = []
        for (index, slide) in slides.enumerated() {
            let leadSeconds = index == 0 ? introSeconds : interSlideLeadSeconds
            let tailSeconds = index == slides.count - 1 ? outroSeconds : interSlideTailSeconds
            clipStartSeconds.append(Double(frameIndex) / Double(framesPerSecond) + leadSeconds)
            let seconds = leadSeconds + CMTimeGetSeconds(clipDurations[index]) + tailSeconds
            let frameCount = max(1, Int((seconds * Double(framesPerSecond)).rounded()))
            let buffer = try makePixelBuffer(from: captionedImage(slide: slide))
            for _ in 0..<frameCount {
                while !input.isReadyForMoreMediaData {
                    try await Task.sleep(for: .milliseconds(5))
                }
                let presentationTime = CMTime(value: frameIndex, timescale: framesPerSecond)
                guard adaptor.append(buffer, withPresentationTime: presentationTime) else {
                    throw RenderError.writer(writer.error?.localizedDescription ?? "could not append frame")
                }
                frameIndex += 1
            }
        }
        input.markAsFinished()
        writer.endSession(atSourceTime: CMTime(value: frameIndex, timescale: framesPerSecond))
        await writer.finishWriting()
        guard writer.status == .completed else {
            throw RenderError.writer(writer.error?.localizedDescription ?? "unknown failure")
        }

        let videoAsset = AVURLAsset(url: silentURL)
        let videoDuration = try await videoAsset.load(.duration)
        guard let sourceVideoTrack = try await videoAsset.loadTracks(withMediaType: .video).first else {
            throw RenderError.missingTrack("video")
        }
        let composition = AVMutableComposition()
        guard let compositionVideo = composition.addMutableTrack(
            withMediaType: .video,
            preferredTrackID: kCMPersistentTrackID_Invalid
        ) else {
            throw RenderError.missingTrack("composition video")
        }
        guard let compositionAudio = composition.addMutableTrack(
            withMediaType: .audio,
            preferredTrackID: kCMPersistentTrackID_Invalid
        ) else {
            throw RenderError.missingTrack("composition audio")
        }
        try compositionVideo.insertTimeRange(
            CMTimeRange(start: .zero, duration: videoDuration),
            of: sourceVideoTrack,
            at: .zero
        )
        for index in clipTracks.indices {
            try compositionAudio.insertTimeRange(
                CMTimeRange(start: .zero, duration: clipDurations[index]),
                of: clipTracks[index],
                at: CMTime(seconds: clipStartSeconds[index], preferredTimescale: 600)
            )
        }

        guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
            throw RenderError.export("could not create export session")
        }
        exporter.shouldOptimizeForNetworkUse = true
        try await exporter.export(to: outputURL, as: .mp4)

        let finalAsset = AVURLAsset(url: outputURL)
        let finalDuration = try await finalAsset.load(.duration)
        let finalVideoTracks = try await finalAsset.loadTracks(withMediaType: .video)
        let finalAudioTracks = try await finalAsset.loadTracks(withMediaType: .audio)
        print("duration_seconds=\(String(format: "%.2f", CMTimeGetSeconds(finalDuration)))")
        print("narration_provider=\(manifest.provider)")
        print("narration_voice=\(manifest.voice)")
        print("narration_clips=\(manifest.clips.count)")
        print("video_tracks=\(finalVideoTracks.count)")
        print("audio_tracks=\(finalAudioTracks.count)")
        print("output=\(outputURL.path)")
    }
}
