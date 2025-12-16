import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator, Switch } from 'react-native';
import { getServerIp, setServerIp, discoverServer } from '../api';

export default function SettingsScreen({ onSave, theme, onToggleTheme }) {
    const [ip, setIp] = useState('');
    const [scanning, setScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState('');

    useEffect(() => {
        loadIp();
    }, []);

    const loadIp = async () => {
        const savedIp = await getServerIp();
        if (savedIp) setIp(savedIp);
    };

    const handleSave = async () => {
        if (!ip.trim()) {
            Alert.alert('Error', 'Please enter an IP address');
            return;
        }
        await setServerIp(ip.trim());
        onSave();
    };

    const handleAutoDiscover = async () => {
        setScanning(true);
        setScanProgress('Scanning network...');

        const foundIp = await discoverServer((current, total) => {
            setScanProgress(`Scanning... ${Math.round((current / total) * 100)}%`);
        });

        setScanning(false);
        setScanProgress('');

        if (foundIp) {
            setIp(foundIp);
            Alert.alert('Success', `Found server at ${foundIp}`);
        } else {
            Alert.alert('Not Found', 'Could not find server. Make sure the desktop app is running and you are on the same Wi-Fi.');
        }
    };

    const isNeumorphic = theme === 'neumorphic';

    return (
        <View style={[styles.container, isNeumorphic && styles.neuContainer]}>
            <Text style={[styles.label, isNeumorphic && styles.neuText]}>Desktop Server IP Address:</Text>
            <Text style={styles.hint}>e.g., 192.168.1.5:5000</Text>
            <TextInput
                style={[styles.input, isNeumorphic && styles.neuInput]}
                value={ip}
                onChangeText={setIp}
                placeholder="192.168.1.x:5000"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={isNeumorphic ? '#999' : '#ccc'}
            />

            <View style={styles.buttonContainer}>
                <Button title="Save & Connect" onPress={handleSave} />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
                <Text style={[styles.label, isNeumorphic && styles.neuText, { marginBottom: 0 }]}>Neumorphic Theme</Text>
                <Switch
                    value={isNeumorphic}
                    onValueChange={(val) => onToggleTheme(val ? 'neumorphic' : 'default')}
                />
            </View>

            <View style={styles.divider} />

            <View style={styles.buttonContainer}>
                {scanning ? (
                    <View style={styles.scanningContainer}>
                        <ActivityIndicator size="small" color="#007bff" />
                        <Text style={styles.scanningText}>{scanProgress}</Text>
                    </View>
                ) : (
                    <Button title="Auto Discover Server" onPress={handleAutoDiscover} color="#666" />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    label: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    hint: {
        fontSize: 14,
        color: '#666',
        marginBottom: 15,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 10,
        fontSize: 16,
        marginBottom: 20,
    },
    buttonContainer: {
        marginBottom: 10,
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 20,
    },
    scanningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
    },
    scanningText: {
        marginLeft: 10,
        color: '#666',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    neuContainer: {
        backgroundColor: '#e0e5ec',
    },
    neuText: {
        color: '#4a4a4a',
    },
    neuInput: {
        backgroundColor: '#e0e5ec',
        borderColor: 'transparent',
        borderRadius: 50,
        paddingHorizontal: 20,
        // Neumorphic inset shadow simulation
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 0,
        },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 0, // Android doesn't support inset shadow easily, keeping it flat
        borderWidth: 0,
    }
});
