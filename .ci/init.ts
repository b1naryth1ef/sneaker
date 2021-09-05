import { GithubCheckRunPlugin } from "pkg/buildy/github@1/plugins.ts";
import { registerPlugin, Workspace } from "runtime/core.ts";

export async function setup(ws: Workspace) {
  registerPlugin(
    new GithubCheckRunPlugin({
      repositorySlug: "b1naryth1ef/sneaker",
    }),
  );
}
