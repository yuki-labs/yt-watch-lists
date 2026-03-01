import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator, Animated } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SettingsScreen from './components/SettingsScreen';
import HomeScreen from './components/HomeScreen';
import { getServerIp, getTheme, saveTheme, getColorScheme, saveColorScheme } from './api';
import { m3Theme, m3DarkTheme, getColors } from './theme/m3Theme';
import { ThemeTransitionProvider, useThemeTransition } from './theme/ThemeTransition';

function AppContent({ hasIp, showSettings, setHasIp, setShowSettings, theme, colorScheme, onToggleColorScheme }) {
  const { progress } = useThemeTransition();
  const colors = getColors(colorScheme);

  // Animated background that morphs between themes
  const neuBase = colorScheme === 'dark' ? '#2a2d32' : '#e0e5ec';
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surface, neuBase],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor }]}>
      {hasIp && !showSettings ? (
        <HomeScreen
          onSettings={() => setShowSettings(true)}
          theme={theme}
          colorScheme={colorScheme}
          onToggleColorScheme={onToggleColorScheme}
        />
      ) : (
        <SettingsScreen
          onSave={() => { setHasIp(true); setShowSettings(false); }}
          onBack={hasIp ? () => setShowSettings(false) : null}
          theme={theme}
          colorScheme={colorScheme}
          onToggleColorScheme={onToggleColorScheme}
        />
      )}
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </Animated.View>
  );
}

export default function App() {
  const [hasIp, setHasIp] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState('default');
  const [colorScheme, setColorScheme] = useState('light');

  useEffect(() => {
    checkIp();
    loadTheme();
    loadColorScheme();
  }, []);

  const checkIp = async () => {
    const ip = await getServerIp();
    setHasIp(!!ip);
  };

  const loadTheme = async () => {
    const t = await getTheme();
    setTheme(t);
  };

  const loadColorScheme = async () => {
    const s = await getColorScheme();
    setColorScheme(s);
  };

  const handleThemeChange = useCallback(async (newTheme) => {
    setTheme(newTheme);
    await saveTheme(newTheme);
  }, []);

  const handleToggleColorScheme = useCallback(async () => {
    const next = colorScheme === 'light' ? 'dark' : 'light';
    setColorScheme(next);
    await saveColorScheme(next);
  }, [colorScheme]);

  const paperTheme = colorScheme === 'dark' ? m3DarkTheme : m3Theme;
  const colors = getColors(colorScheme);

  if (hasIp === null) {
    return (
      <PaperProvider theme={paperTheme}>
        <SafeAreaProvider>
          <View style={[styles.container, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </SafeAreaProvider>
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={paperTheme}>
      <SafeAreaProvider>
        <ThemeTransitionProvider theme={theme} onThemeChange={handleThemeChange}>
          <AppContent
            hasIp={hasIp}
            showSettings={showSettings}
            setHasIp={setHasIp}
            setShowSettings={setShowSettings}
            theme={theme}
            colorScheme={colorScheme}
            onToggleColorScheme={handleToggleColorScheme}
          />
        </ThemeTransitionProvider>
      </SafeAreaProvider>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
