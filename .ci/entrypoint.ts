import * as Docker from "pkg/buildy/docker@1/mod.ts";
import { uploadArtifact } from "runtime/artifacts.ts";
import { print, pushStep, spawnChildJob, Workspace } from "runtime/core.ts";

export async function build(
  ws: Workspace,
  { os, arch, version }: { os?: string; arch?: string; version?: string },
) {
  pushStep("Build Sneaker UI");
  const yarnRes = await Docker.run(
    "yarn && yarn build",
    {
      image: "node:16",
      copy: [
        "dist/**",
        "src/**",
        "*.js",
        "package.json",
        "tsconfig.json",
        "yarn.lock",
      ],
    },
  );

  await yarnRes.copy("dist/");

  pushStep("Build Sneaker Binary");
  const res = await Docker.run(
    "mkdir /tmp/build && mv cmd dist server assets.go go.mod go.sum /tmp/build && cd /tmp/build && go build -o sneaker cmd/sneaker-server/main.go && mv sneaker /",
    {
      image: `golang:1.17`,
      copy: ["cmd/**", "dist/**", "server/**", "assets.go", "go.mod", "go.sum"],
      env: [`GOOS=${os || "linux"}`, `GOARCH=${arch || "amd64"}`],
    },
  );

  if (version !== undefined) {
    await res.copy("/sneaker");

    pushStep("Upload Sneaker Binary");
    const uploadRes = await uploadArtifact("sneaker", {
      name: `sneaker-${os}-${arch}-${version}`,
      published: true,
      labels: [
        "sneaker",
        `arch:${arch}`,
        `os:${os}`,
        `version:${version}`,
      ],
    });
    print(
      `Uploaded binary to ${
        uploadRes.generatePublicURL(
          ws.org,
          ws.repository,
        )
      }`,
    );
  }
}

const semVerRe =
  /v([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+)?/;

export async function githubPush(ws: Workspace) {
  let version;

  const versionTags = ws.commit.tags.filter((tag) => semVerRe.test(tag));
  if (versionTags.length == 1) {
    print(`Found version tag ${versionTags[0]}, will build release artifacts.`);
    version = versionTags[0];
  } else if (versionTags.length > 1) {
    throw new Error(`Found too many version tags: ${versionTags}`);
  }

  await spawnChildJob(".ci/entrypoint.ts:build", {
    alias: "Build Linux amd64",
    args: { os: "linux", arch: "amd64", version: version },
  });

  await spawnChildJob(".ci/entrypoint.ts:build", {
    alias: "Build Windows amd64",
    args: { os: "windows", arch: "amd64", version: version },
  });
}
