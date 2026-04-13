import type { Config } from "jest";

const config: Config = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest-setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|heroui-native|@gorhom|nativewind|expo-router|@trpc|@tanstack|.bun)",
  ],
  moduleNameMapper: {
    "\\.css$": "<rootDir>/jest-mocks/style-mock.ts",
    "^@/(.*)$": "<rootDir>/$1",
    "^react-native-reanimated$": "<rootDir>/jest-mocks/react-native-reanimated.ts",
    "^react-native-worklets$": "<rootDir>/jest-mocks/react-native-worklets.ts",
    "^heroui-native$": "<rootDir>/jest-mocks/heroui-native.tsx",
    "^react-native-safe-area-context$": "<rootDir>/jest-mocks/react-native-safe-area-context.ts",
    // Expo 55 "winter" uses import.meta which breaks in Jest CJS mode
    "^expo/src/winter/(.*)$": "<rootDir>/jest-mocks/expo-winter.ts",
    "^expo/src/winter$": "<rootDir>/jest-mocks/expo-winter.ts",
  },
};

export default config;
