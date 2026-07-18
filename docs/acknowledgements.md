# Third-party acknowledgements

PatchPilot is MIT-licensed. It depends on and interoperates with open-source projects that remain under their own licenses.

| Project | Role in PatchPilot | License |
| --- | --- | --- |
| [OSV-Scanner](https://github.com/google/osv-scanner) | Deterministic vulnerability scan and rescan CLI; downloaded separately by the setup script | Apache-2.0 |
| [OpenAI JavaScript SDK](https://github.com/openai/openai-node) | Responses API and Structured Outputs integration | Apache-2.0 |
| [React](https://react.dev/) and [React DOM](https://react.dev/) | Local demo UI | MIT |
| [Vite](https://vite.dev/) | Frontend build | MIT |
| [Zod](https://zod.dev/) | Runtime contracts and Structured Output schemas | MIT |
| [Vitest](https://vitest.dev/) | Unit and integration tests | MIT |
| [TypeScript](https://www.typescriptlang.org/) | Application language and compiler | Apache-2.0 |
| [tsx](https://tsx.is/) | TypeScript command runner for local scripts | MIT |
| [json5](https://github.com/json5/json5) | Deliberately vulnerable direct dependency in the isolated golden fixture | MIT |

Package versions are locked in `package-lock.json`; the demo fixture has its own lockfile. The intentionally vulnerable json5 version exists only to make the safe, local remediation path reproducible. PatchPilot does not distribute OSV-Scanner or a vulnerability database.

Vulnerability facts in the demo originate from OSV-Scanner/OSV and the bundled normalized advisory cache. The cached copy is used for deterministic presentation and is labeled `cached-demo`, not fresh upstream data.
