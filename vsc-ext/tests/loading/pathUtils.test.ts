import * as assert from "assert";
import {
  collapseMrecStoreUri,
  getDisplayName,
  isMrecUriPath,
  isMrecZipPath,
  isStlPath,
  localizeRemoteUri,
  mrecStoreRootPath,
} from "../../src/extension/loading/pathUtils";

suite("pathUtils", () => {
  test("getDisplayName returns basename", () => {
    const uri = { fsPath: "/tmp/a/b/frame.xyz" } as never;
    assert.strictEqual(getDisplayName(uri), "frame.xyz");
  });

  test("mrecStoreRootPath accepts the store and any path inside it", () => {
    assert.strictEqual(
      mrecStoreRootPath("/tmp/data/root.mrec"),
      "/tmp/data/root.mrec",
    );
    assert.strictEqual(
      mrecStoreRootPath("/tmp/data/root.mrec/"),
      "/tmp/data/root.mrec",
    );
    assert.strictEqual(
      mrecStoreRootPath("/tmp/data/root.mrec/zarr.json"),
      "/tmp/data/root.mrec",
    );
    assert.strictEqual(
      mrecStoreRootPath("/tmp/data/root.mrec/trajectory/atoms/x/c/0"),
      "/tmp/data/root.mrec",
    );
  });

  test("mrecStoreRootPath rejects packed zip and non-mrec paths", () => {
    assert.strictEqual(mrecStoreRootPath("/tmp/data/root.mrec.zip"), undefined);
    assert.strictEqual(mrecStoreRootPath("/tmp/data/root.zarr"), undefined);
    assert.strictEqual(mrecStoreRootPath("/tmp/data/frame.xyz"), undefined);
  });

  test("collapseMrecStoreUri rewrites nested keys to the store root", () => {
    const nested = {
      path: "/tmp/data/root.mrec/zarr.json",
      with(change: { path: string }) {
        return { path: change.path };
      },
    };
    const collapsed = collapseMrecStoreUri(nested as never);
    assert.strictEqual(collapsed.path, "/tmp/data/root.mrec");
  });

  test("isMrecUriPath matches directory mrec path", () => {
    const uri = { path: "/tmp/data/root.mrec" } as never;
    assert.strictEqual(isMrecUriPath(uri, 2), true);
  });

  test("isMrecUriPath matches trailing-slash mrec directory", () => {
    const uri = { path: "/tmp/data/root.mrec/" } as never;
    assert.strictEqual(isMrecUriPath(uri, 2), true);
  });

  test("isMrecUriPath rejects files and non-mrec directories", () => {
    const fileUri = { path: "/tmp/data/root.mrec" } as never;
    const dirUri = { path: "/tmp/data/root.xyz" } as never;
    const zarrUri = { path: "/tmp/data/root.zarr" } as never;

    assert.strictEqual(isMrecUriPath(fileUri, 1), false);
    assert.strictEqual(isMrecUriPath(dirUri, 2), false);
    assert.strictEqual(isMrecUriPath(zarrUri, 2), false);
  });
});

suite("pathUtils / packed mrec", () => {
  test("isMrecZipPath matches the packed suffix only", () => {
    assert.strictEqual(isMrecZipPath("/tmp/data/root.mrec.zip"), true);
    assert.strictEqual(isMrecZipPath("C:\\data\\ROOT.MREC.ZIP"), true);
    assert.strictEqual(isMrecZipPath("/tmp/data/root.mrec"), false);
    assert.strictEqual(isMrecZipPath("/tmp/data/root.zip"), false);
  });
});

suite("pathUtils / STL meshes", () => {
  test("isStlPath matches the suffix, case-insensitively", () => {
    assert.strictEqual(isStlPath("/runs/cavity.stl"), true);
    assert.strictEqual(isStlPath("C:\\meshes\\CAVITY.STL"), true);
    assert.strictEqual(isStlPath("/runs/cavity.stl.gz"), false);
    assert.strictEqual(isStlPath("/runs/still.lammpstrj"), false);
  });
});

suite("pathUtils / remote authority", () => {
  function uriLike(scheme: string, authority: string, uriPath: string) {
    return {
      scheme,
      authority,
      path: uriPath,
      with(change: { scheme?: string; authority?: string }) {
        return uriLike(
          change.scheme ?? scheme,
          change.authority ?? authority,
          uriPath,
        );
      },
    };
  }

  test("a drop from this remote window becomes a local file URI", () => {
    const dropped = uriLike(
      "vscode-remote",
      "ssh-remote+rackham",
      "/runs/c.stl",
    );
    const local = localizeRemoteUri(dropped as never, "ssh-remote");
    assert.strictEqual(local.scheme, "file");
    assert.strictEqual(local.authority, "");
    assert.strictEqual(local.path, "/runs/c.stl");
  });

  test("authority kind match ignores case", () => {
    const dropped = uriLike(
      "vscode-remote",
      "SSH-Remote+Rackham",
      "/runs/c.stl",
    );
    assert.strictEqual(
      localizeRemoteUri(dropped as never, "ssh-remote").scheme,
      "file",
    );
  });

  test("another kind of authority stays remote, so the caller rejects it", () => {
    const dropped = uriLike("vscode-remote", "codespaces+abc", "/runs/c.stl");
    const kept = localizeRemoteUri(dropped as never, "ssh-remote");
    assert.strictEqual(kept.scheme, "vscode-remote");
    assert.strictEqual(kept.authority, "codespaces+abc");
  });

  test("wsl authorities localize the same way", () => {
    const dropped = uriLike("vscode-remote", "wsl+Ubuntu", "/runs/c.stl");
    assert.strictEqual(
      localizeRemoteUri(dropped as never, "wsl").scheme,
      "file",
    );
  });

  test("a local window never rewrites a remote URI", () => {
    const dropped = uriLike(
      "vscode-remote",
      "ssh-remote+rackham",
      "/runs/c.stl",
    );
    assert.strictEqual(
      localizeRemoteUri(dropped as never, undefined).scheme,
      "vscode-remote",
    );
  });

  test("file and virtual schemes pass through untouched", () => {
    const local = uriLike("file", "", "/runs/c.stl");
    assert.strictEqual(
      localizeRemoteUri(local as never, "ssh-remote").scheme,
      "file",
    );
    const virtual = uriLike("vscode-vfs", "github", "/org/repo/c.stl");
    assert.strictEqual(
      localizeRemoteUri(virtual as never, "ssh-remote").scheme,
      "vscode-vfs",
    );
  });
});
