const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [projectRoot];
config.resolver.blockList = [
  new RegExp(`${path.resolve(workspaceRoot, ".next")}/.*`),
  new RegExp(`${path.resolve(workspaceRoot, "node_modules/.cache")}/.*`),
];

module.exports = config;
