module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: "^(?!.*\\.integration\\.spec\\.ts$).*\\.spec\\.ts$",
  transform: { "^.+\\.(t|j)s$": "ts-jest" },
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@erp/(.*)$": "<rootDir>/../../../packages/$1/src",
    "^jose$": "<rootDir>/test/__mocks__/jose.ts",
  },
};
