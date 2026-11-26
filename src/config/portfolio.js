import portfolioConfig from "../../portfolio.config.json";

export const config = portfolioConfig;
export const identity = portfolioConfig.identity;
export const githubUrl = `https://github.com/${encodeURIComponent(identity.github)}`;
export const themeStorageKey = `${identity.storagePrefix || "portfolio"}.scheme`;
export const wormStorageKey = `${identity.storagePrefix || "portfolio"}.worm`;
