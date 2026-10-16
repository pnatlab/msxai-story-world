import { expect, test } from "vitest";
import type { ConfigEnv, UserConfig } from "vite";
import config from "../vite.config";

test.each([
  { command: "serve", isPreview: false, expected: "/" },
  { command: "build", isPreview: false, expected: "/msxai-story-world/" },
  { command: "serve", isPreview: true, expected: "/msxai-story-world/" },
] as const)("$command (preview=$isPreview) resolves the correct asset base", ({ command, isPreview, expected }) => {
  const resolved = (config as (env: ConfigEnv) => UserConfig)({ command, isPreview, mode: "production" });
  expect(resolved.base).toBe(expected);
});
