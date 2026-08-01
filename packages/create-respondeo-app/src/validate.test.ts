import { describe, it, expect, afterEach, vi } from "vitest";
import { resolve } from "node:path";
import { validateProjectName, resolveProjectPath } from "./validate";

describe("validateProjectName", () => {
  it("accepts an ordinary project name", () => {
    expect(validateProjectName("my-quiz-app")).toBeUndefined();
  });

  it("accepts a nested relative path", () => {
    expect(validateProjectName("apps/my-quiz")).toBeUndefined();
  });

  it("rejects empty input", () => {
    expect(validateProjectName(undefined)).toBeTruthy();
    expect(validateProjectName("")).toBeTruthy();
    expect(validateProjectName("   ")).toBeTruthy();
  });

  it("rejects parent-directory traversal", () => {
    // The resolved path feeds rmSync(recursive, force). Validating only the
    // final segment let these through, because that segment looks ordinary.
    expect(validateProjectName("../evil")).toBeTruthy();
    expect(validateProjectName("../../evil")).toBeTruthy();
    expect(validateProjectName("foo/../../evil")).toBeTruthy();
    expect(validateProjectName("..")).toBeTruthy();
  });

  it("keeps every accepted path inside the working directory", () => {
    const cwd = process.cwd();
    const candidates = ["ok", "a/b/c", "../escape", "foo/../../escape", "../../../tmp/x"];

    for (const candidate of candidates) {
      if (validateProjectName(candidate) === undefined) {
        expect(resolveProjectPath(candidate).startsWith(cwd)).toBe(true);
      }
    }
  });

  it("rejects absolute paths", () => {
    expect(validateProjectName("/tmp/evil")).toBeTruthy();
  });

  it("rejects names starting with a dot or hyphen, in any segment", () => {
    expect(validateProjectName(".hidden")).toBeTruthy();
    expect(validateProjectName("-flag")).toBeTruthy();
    expect(validateProjectName("apps/.hidden")).toBeTruthy();
    expect(validateProjectName("apps/-flag")).toBeTruthy();
  });

  it("rejects a path that resolves to the working directory itself", () => {
    expect(validateProjectName(".")).toBeTruthy();
  });

  it("rejects characters outside the allowed set", () => {
    expect(validateProjectName("my app")).toBeTruthy();
    expect(validateProjectName("app;rm -rf /")).toBeTruthy();
    expect(validateProjectName("app$(whoami)")).toBeTruthy();
    expect(validateProjectName("app`id`")).toBeTruthy();
  });
});

describe("resolveProjectPath", () => {
  it("resolves relative to the working directory", () => {
    // Built with node:path rather than a "/" template literal: the CLI is
    // published to npm and runs on Windows, where the separator is "\".
    expect(resolveProjectPath("my-app")).toBe(resolve(process.cwd(), "my-app"));
  });

  it("resolves a nested path relative to the working directory", () => {
    expect(resolveProjectPath("apps/my-app")).toBe(resolve(process.cwd(), "apps", "my-app"));
  });
});

describe("validateProjectName from a filesystem root", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts an ordinary name when cwd is the filesystem root", () => {
    // `resolved.startsWith(cwd + sep)` fails here: cwd + sep is "//", which
    // "/my-app" does not start with, so every name was rejected. Running from
    // "/" is ordinary inside a container.
    vi.spyOn(process, "cwd").mockReturnValue("/");

    expect(validateProjectName("my-app")).toBeUndefined();
    expect(validateProjectName("apps/my-app")).toBeUndefined();
  });

  it("still rejects traversal when cwd is the filesystem root", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/");

    expect(validateProjectName("..")).toBeTruthy();
    expect(validateProjectName("../elsewhere")).toBeTruthy();
    expect(validateProjectName(".")).toBeTruthy();
  });
});
