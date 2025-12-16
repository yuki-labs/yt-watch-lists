import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import SettingsScreen from './components/SettingsScreen';
import HomeScreen from './components/HomeScreen';
import { getServerIp, getTheme, saveTheme } from './api';

export default function App() {
  const [hasIp, setHasIp] = useState(null);
  const [theme, setTheme] = useState('default');

  useEffect(() => {
    checkIp();
    loadTheme();
  }, []);

  const checkIp = async () => {
    const ip = await getServerIp();
    setHasIp(!!ip);
  };

  const loadTheme = async () => {
    const t = await getTheme();
    setTheme(t);
  };

  const updateTheme = async (newTheme) => {
    setTheme(newTheme);
    await saveTheme(newTheme);
  };

  if (hasIp === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const containerStyle = theme === 'neumorphic' ? { backgroundColor: '#e0e5ec' } : { backgroundColor: '#fff' };

  return (
    <View style={[styles.container, containerStyle]}>
      {hasIp ? (
        <HomeScreen
          onSettings={() => setHasIp(false)}
          theme={theme}
        />
      ) : (
        <SettingsScreen
          onSave={() => setHasIp(true)}
          theme={theme}
          onToggleTheme={updateTheme}
        />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
