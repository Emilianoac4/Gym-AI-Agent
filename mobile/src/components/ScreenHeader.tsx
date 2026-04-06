import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { designSystem as ds } from "../theme/designSystem";

type Props = {
  title: string;
  subtitle: string;
  auxiliary?: string;
  style?: StyleProp<ViewStyle>;
  trailing?: React.ReactNode;
};

export function ScreenHeader({ title, subtitle, auxiliary, style, trailing }: Props) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.copyBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {auxiliary ? <Text style={styles.auxiliary}>{auxiliary}</Text> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: ds.spacing.x2,
  },
  copyBlock: {
    flex: 1,
    gap: ds.spacing.x1,
  },
  trailing: {
    justifyContent: "flex-start",
  },
  title: {
    color: ds.colors.textPrimary,
    fontSize: ds.typography.titleLG,
    lineHeight: 30,
    fontWeight: "700",
    fontFamily: ds.typography.fontFamily,
  },
  subtitle: {
    color: ds.colors.textSecondary,
    fontSize: ds.typography.bodyLG,
    lineHeight: 24,
    fontWeight: "500",
    fontFamily: ds.typography.fontFamily,
  },
  auxiliary: {
    color: ds.colors.textSecondary,
    fontSize: ds.typography.bodySM,
    lineHeight: 18,
    fontWeight: "500",
    fontFamily: ds.typography.fontFamily,
  },
});
