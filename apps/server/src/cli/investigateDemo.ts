import path from "node:path";
import { investigateRepository } from "../investigation/investigateRepository.js";

const projectRoot = process.cwd();
const result = await investigateRepository({
  repositoryPath: path.join(projectRoot, "demo/vulnerable-node-app"),
  projectRoot,
});

console.log(JSON.stringify(result, null, 2));
