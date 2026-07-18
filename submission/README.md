# Submission video assets

`video-narration.txt` is the approved voice-over copy for the local review cut. The render uses actual 1280×720 PatchPilot UI captures from a clean golden run.

Generate the review artifact on macOS:

```bash
./scripts/render-demo-video.sh
```

The script uses the built-in `say` voice synthesizer and AVFoundation. It writes ignored, regenerable assets under `submission/artifacts/`:

- `patchpilot-demo.mp4` — H.264/AAC review cut;
- `patchpilot-narration.aiff` — intermediate narration;
- `patchpilot-demo-silent.mov` — intermediate video.

The checked-in UI captures under `submission/video-frames/` are produced from one clean real local demo, not mocked screens. This makes the review cut reproducible from a clean macOS clone without rerunning the browser capture. The MP4 is still a review artifact until a human approves publication. Uploading, making the video public, and inserting its URL into the final submission remain separate actions.
