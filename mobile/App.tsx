import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

// Some RN runtimes/devtools expect User Timing methods on performance.
// Provide no-op fallbacks to avoid crashes in environments where they are missing.
const perf = (globalThis as any).performance;
if (perf && typeof perf === "object") {
  if (typeof perf.mark !== "function") perf.mark = () => {};
  if (typeof perf.measure !== "function") perf.measure = () => {};
  if (typeof perf.clearMarks !== "function") perf.clearMarks = () => {};
  if (typeof perf.clearMeasures !== "function") perf.clearMeasures = () => {};
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
