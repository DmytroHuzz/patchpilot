# Submission video assets

`video-narration.txt` contains nine voice-over beats, one for each slide in the local review cut. The renderer measures every narration clip and changes slides only between spoken beats, so the voice and visible workflow remain synchronized. It uses actual 1280×720 PatchPilot UI captures from a clean golden run.

For the natural neural narration used by the current review cut, install the optional [edge-tts CLI](https://github.com/rany2/edge-tts) outside the project, then provide its executable explicitly:

```bash
pipx install edge-tts==7.2.8
PATCHPILOT_EDGE_TTS_BIN="$(command -v edge-tts)" ./scripts/render-demo-video.sh
```

This sends only the public narration paragraphs to Microsoft Edge's online speech service. It does not send source code, evidence, credentials, or repository data. The default voice is `en-US-AndrewMultilingualNeural`; override it or its rate with `PATCHPILOT_EDGE_TTS_VOICE` and `PATCHPILOT_EDGE_TTS_RATE`.

Without the optional CLI, the same command remains fully local and falls back to the installed macOS Reed voice:

```bash
./scripts/render-demo-video.sh
```

Override the local narrator when comparing voices or pacing:

```bash
PATCHPILOT_VIDEO_VOICE="Daniel" PATCHPILOT_VIDEO_RATE=160 ./scripts/render-demo-video.sh
```

The script uses AVFoundation and writes ignored, regenerable assets under `submission/artifacts/`:

- `patchpilot-demo.mp4` — H.264/AAC review cut;
- `narration-clips/` — nine intermediate voice clips plus their provider manifest;
- `patchpilot-demo-silent.mov` — intermediate video.

The checked-in UI captures under `submission/video-frames/` are produced from one clean real local demo, not mocked screens. This makes the review cut reproducible from a clean macOS clone without rerunning the browser capture. All narration options are synthetic and must remain disclosed. The MP4 remains a review artifact until a human approves public visibility. Making the video public and inserting its URL into the final submission remain separate actions.

Current review upload: [PatchPilot — Human-Reviewed Dependency Patching | OpenAI Build Week](https://youtu.be/9PyrTSgSAhU). It is unlisted, marked not made for kids, and uses the description above to disclose synthetic narration. Public visibility remains a separate approval-gated action.
