module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.integration\\.spec\\.ts$",
  transform: { "^.+\\.(t|j)s$": "ts-jest" },
  testEnvironment: "node",
  testTimeout: 60000,
  moduleNameMapper: {
    "^@erp/(.*)$": "<rootDir>/../../../packages/$1/src",
  },
};
