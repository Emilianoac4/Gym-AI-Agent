function resolveExpoPreset() {
  try {
    return require.resolve("babel-preset-expo");
  } catch {
    return require.resolve("expo/node_modules/babel-preset-expo");
  }
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [resolveExpoPreset()],
  };
};
