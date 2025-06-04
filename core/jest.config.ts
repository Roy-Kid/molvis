import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: true,
            decorators: true,
          },
          target: "es2022",
        },
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!@babylonjs/.*)"],
  extensionsToTreatAsEsm: [".ts"],
  rootDir: "./",
  moduleNameMapper: {
    "@molvis/core": "<rootDir>/src/index.ts",
    "^@molvis/core/(.*)$": "<rootDir>/src/$1"
  },
};

export default config;
