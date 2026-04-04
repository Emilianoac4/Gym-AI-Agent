import React from "react";
import {
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { designSystem } from "../theme/designSystem";

type BaseProps = {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

type ScrollableProps = BaseProps & {
  scrollable?: true;
  scrollProps?: Omit<ScrollViewProps, "contentContainerStyle">;
};

type StaticProps = BaseProps & {
  scrollable?: false;
  viewProps?: ViewProps;
};

type Props = ScrollableProps | StaticProps;

export function AppScreen(props: Props) {
  if (props.scrollable) {
    const { children, contentStyle, scrollProps } = props;

    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          {...scrollProps}
          contentContainerStyle={[styles.content, contentStyle]}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const { children, contentStyle } = props;
  const viewProps = "viewProps" in props ? props.viewProps : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={[styles.content, contentStyle]} {...viewProps}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: designSystem.colors.background,
  },
  content: {
    paddingHorizontal: designSystem.spacing.x3,
    paddingTop: designSystem.spacing.x2,
    paddingBottom: designSystem.spacing.x4,
    gap: designSystem.spacing.x2,
  },
});
