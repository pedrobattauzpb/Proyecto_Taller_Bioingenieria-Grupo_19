import React from 'react';
import { View, StyleSheet, useWindowDimensions, SafeAreaView } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768; // Breakpoint responsive

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <Header />
      <View style={styles.mainContainer}>
        {isDesktop && <Sidebar />}
        <View style={styles.contentContainer}>
          <Slot />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
});
