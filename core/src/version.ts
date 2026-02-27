import corePackage from "../package.json";

type PackageWithVersion = { version?: string };

const version = (corePackage as PackageWithVersion).version;

export const MOLVIS_VERSION =
  typeof version === "string" && version.length > 0 ? version : "0.0.0";
