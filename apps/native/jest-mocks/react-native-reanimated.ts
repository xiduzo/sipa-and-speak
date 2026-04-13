/**
 * Minimal reanimated mock — avoids native binaries entirely.
 * react-native-reanimated v4 requires worklets; we stub both here.
 */
import React from "react";
import { View } from "react-native";

const createAnimatedComponent = (Component: React.ComponentType<unknown>) => Component;

const Animated = {
  View,
  Text: require("react-native").Text,
  ScrollView: require("react-native").ScrollView,
  FlatList: require("react-native").FlatList,
  Image: require("react-native").Image,
  createAnimatedComponent,
};

module.exports = { ...Animated, default: Animated, createAnimatedComponent };
