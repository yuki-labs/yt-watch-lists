import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Alert,
    ActivityIndicator,
    TouchableOpacity,
    TextInput as RNTextInput,
    Animated,
    ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import { getColors, getNeuColors } from '../theme/m3Theme';
import { getServerIp, setServerIp, discoverServer, testConnection, getDeviceIp } from '../api';
import { useThemeTransition } from '../theme/ThemeTransition';

export default function SettingsScreen({ onSave, onBack, theme, colorScheme }) {
    const [ip, setIp] = useState('');
    const [scanning, setScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState('');
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [deviceIp, setDeviceIp] = useState(null);
    const { progress, animateToTheme } = useThemeTransition();

    const isNeu = theme === 'neumorphic';
    const isDark = colorScheme === 'dark';
    const colors = getColors(colorScheme);
    const nc = getNeuColors(colorScheme);

    // ── Neumorphic boxShadow definitions ──
    const neuCardShadow = [
        { offsetX: 6, offsetY: 6, blurRadius: 14, spreadDistance: 0, color: `${nc.shadowDark}0.55)` },
        { offsetX: -6, offsetY: -6, blurRadius: 14, spreadDistance: 0, color: `${nc.shadowLight}0.75)` },
    ];
    const neuBtnShadow = [
        { offsetX: 4, offsetY: 4, blurRadius: 10, spreadDistance: 0, color: `${nc.shadowDark}0.5)` },
        { offsetX: -4, offsetY: -4, blurRadius: 10, spreadDistance: 0, color: `${nc.shadowLight}0.7)` },
    ];
    const neuInputInsetShadow = [
        { offsetX: 3, offsetY: 3, blurRadius: 7, spreadDistance: 0, color: `${nc.shadowDark}0.6)`, inset: true },
        { offsetX: -3, offsetY: -3, blurRadius: 7, spreadDistance: 0, color: `${nc.shadowLight}0.7)`, inset: true },
    ];
    const neuSwitchTrackShadow = [
        { offsetX: 3, offsetY: 3, blurRadius: 6, spreadDistance: 0, color: `${nc.shadowDark}0.7)`, inset: true },
        { offsetX: -3, offsetY: -3, blurRadius: 6, spreadDistance: 0, color: `${nc.shadowDark}0.4)`, inset: true },
        { offsetX: -2, offsetY: -2, blurRadius: 5, spreadDistance: 0, color: `${nc.shadowLight}0.8)`, inset: true },
    ];
    const neuSwitchThumbShadow = [
        { offsetX: 3, offsetY: 3, blurRadius: 6, spreadDistance: 0, color: `${nc.shadowDark}0.6)` },
        { offsetX: -2, offsetY: -2, blurRadius: 5, spreadDistance: 0, color: `${nc.shadowLight}0.8)` },
    ];
    const m3CardShadow = [
        { offsetX: 0, offsetY: 1, blurRadius: 3, spreadDistance: 0, color: 'rgba(0,0,0,0.12)' },
    ];
    const noShadow = [];

    // ─── Animated interpolations ───
    const neuTrackBg = isDark ? '#1e2024' : '#bec8d4';
    const neuInputBg = isDark ? '#1e2024' : '#d1d9e6';

    const containerBg = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.surface, nc.base],
    });

    const cardBg = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.surfaceContainerLow, nc.base],
    });
    const cardRadius = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [28, 18],
    });
    const cardMarginBottom = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [16, 24],
    });

    const headingColor = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.onSurface, nc.text],
    });
    const subtitleColor = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.onSurfaceVariant, nc.textSecondary],
    });

    const inputBg = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.surfaceContainerHigh, neuInputBg],
    });
    const inputBorderColor = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.outlineVariant, 'transparent'],
    });
    const inputBorderWidth = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
    });
    const inputRadius = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [16, 50],
    });

    const primaryBtnBg = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.primary, nc.base],
    });
    const primaryBtnTextColor = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.onPrimary, nc.text],
    });
    const btnRadius = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [28, 15],
    });

    const secondaryBtnBg = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.secondaryContainer, nc.base],
    });
    const secondaryBtnTextColor = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.onSecondaryContainer, nc.textSecondary],
    });

    const headerBg = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.surfaceContainerLow, nc.base],
    });

    const switchTrackBg = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.surfaceContainerHighest, neuTrackBg],
    });
    const switchTrackWidth = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [52, 60],
    });
    const switchTrackHeight = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [30, 34],
    });
    const switchTrackRadius = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [15, 17],
    });
    const switchThumbX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [2, 29],
    });
    const switchThumbSize = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [24, 28],
    });
    const switchThumbRadius = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [12, 14],
    });
    const switchThumbBg = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.outline, nc.base],
    });

    useEffect(() => {
        loadIp();
        loadDeviceIp();
    }, []);

    const loadIp = async () => {
        const savedIp = await getServerIp();
        if (savedIp) setIp(savedIp);
    };

    const loadDeviceIp = async () => {
        const dip = await getDeviceIp();
        setDeviceIp(dip);
    };

    const handleSave = async () => {
        if (!ip.trim()) {
            Alert.alert('Error', 'Please enter an IP address');
            return;
        }
        await setServerIp(ip.trim());
        onSave();
    };

    const handleTestConnection = async () => {
        if (!ip.trim()) {
            setTestResult({ success: false, message: 'Enter an IP address first' });
            return;
        }
        setTesting(true);
        setTestResult(null);
        const result = await testConnection(ip.trim());
        setTestResult(result);
        setTesting(false);
    };

    const handleAutoDiscover = async () => {
        setScanning(true);
        setScanProgress('Scanning network...');
        setTestResult(null);

        const foundIp = await discoverServer((current, total) => {
            setScanProgress(`Scanning... ${Math.round((current / total) * 100)}%`);
        });

        setScanning(false);
        setScanProgress('');

        if (foundIp) {
            setIp(foundIp);
            setTestResult({ success: true, message: `Found server at ${foundIp}` });
        } else {
            setTestResult({
                success: false,
                message: deviceIp
                    ? `No server found on subnet ${deviceIp.substring(0, deviceIp.lastIndexOf('.'))}.x\nMake sure the desktop app is running.`
                    : 'No server found. Make sure the desktop app is running and both devices are on the same Wi-Fi.',
            });
        }
    };

    const handleToggleTheme = (val) => {
        animateToTheme(val ? 'neumorphic' : 'default');
    };

    // ── Shadow selection based on current theme ──
    const currentCardShadow = isNeu ? neuCardShadow : m3CardShadow;
    const currentBtnShadow = isNeu ? neuBtnShadow : noShadow;
    const currentInputShadow = isNeu ? neuInputInsetShadow : noShadow;

    const cardAnimStyle = {
        backgroundColor: cardBg,
        borderRadius: cardRadius,
        marginBottom: cardMarginBottom,
    };

    return (
        <Animated.View style={[styles.container, { backgroundColor: containerBg }]}>
            {/* ── Header ── */}
            <Animated.View style={[styles.header, { backgroundColor: headerBg }]}>
                {onBack ? (
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <Animated.Text style={[styles.backIcon, { color: headingColor }]}>←</Animated.Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.backBtn} />
                )}
                <Animated.Text style={[styles.headerTitle, { color: headingColor }]}>
                    {onBack ? 'Settings' : 'Configure'}
                </Animated.Text>
                <View style={styles.backBtn} />
            </Animated.View>

            {/* ── Content ── */}
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                <Animated.Text style={[styles.heading, { color: headingColor }]}>
                    Server Setup
                </Animated.Text>
                <Animated.Text style={[styles.subtitle, { color: subtitleColor }]}>
                    Connect to your Watch Later desktop server.
                </Animated.Text>

                {/* ── Device Info Card ── */}
                <Animated.View style={[styles.card, cardAnimStyle, { boxShadow: currentCardShadow }]}>
                    <Animated.Text style={[styles.cardLabel, { color: headingColor }]}>
                        Network Info
                    </Animated.Text>
                    <Animated.Text style={[styles.hint, { color: subtitleColor }]}>
                        Your phone's IP: {deviceIp || 'detecting...'}
                    </Animated.Text>
                    {deviceIp && (
                        <Animated.Text style={[styles.hintSmall, { color: subtitleColor }]}>
                            Subnet: {deviceIp.substring(0, deviceIp.lastIndexOf('.'))}.x — desktop must be on this same subnet
                        </Animated.Text>
                    )}
                </Animated.View>

                {/* ── IP Card ── */}
                <Animated.View style={[styles.card, cardAnimStyle, { boxShadow: currentCardShadow }]}>
                    <Animated.Text style={[styles.cardLabel, { color: headingColor }]}>
                        Desktop Server IP
                    </Animated.Text>
                    <Animated.Text style={[styles.hint, { color: subtitleColor }]}>
                        e.g., 192.168.1.5:5000
                    </Animated.Text>

                    <Animated.View style={[
                        styles.inputWrapper,
                        {
                            backgroundColor: inputBg,
                            borderColor: inputBorderColor,
                            borderWidth: inputBorderWidth,
                            borderRadius: inputRadius,
                            boxShadow: currentInputShadow,
                        }
                    ]}>
                        <RNTextInput
                            value={ip}
                            onChangeText={(text) => { setIp(text); setTestResult(null); }}
                            placeholder="192.168.1.x:5000"
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={[styles.input, { color: isNeu ? nc.text : colors.onSurface }]}
                            placeholderTextColor={isNeu ? nc.placeholderText : colors.onSurfaceVariant}
                        />
                    </Animated.View>

                    {/* Auto Discover inline (initial setup only) */}
                    {!onBack && (
                        scanning ? (
                            <View style={[styles.scanningContainer, { marginBottom: 10 }]}>
                                <ActivityIndicator size="small" color={isNeu ? nc.accent : colors.primary} />
                                <Animated.Text style={[styles.scanningText, { color: subtitleColor }]}>
                                    {scanProgress}
                                </Animated.Text>
                            </View>
                        ) : (
                            <TouchableOpacity activeOpacity={0.7} onPress={handleAutoDiscover} style={{ marginBottom: 10 }}>
                                <Animated.View style={[
                                    styles.btn,
                                    {
                                        backgroundColor: secondaryBtnBg,
                                        borderRadius: btnRadius,
                                        boxShadow: currentBtnShadow,
                                    }
                                ]}>
                                    <Animated.Text style={[styles.btnText, { color: secondaryBtnTextColor }]}>
                                        🔍  Auto Discover Server
                                    </Animated.Text>
                                </Animated.View>
                            </TouchableOpacity>
                        )
                    )}

                    {/* Button row: Test + Save */}
                    <View style={styles.buttonRow}>
                        <TouchableOpacity activeOpacity={0.7} onPress={handleTestConnection} style={styles.buttonHalf} disabled={testing}>
                            <Animated.View style={[
                                styles.btn,
                                {
                                    backgroundColor: secondaryBtnBg,
                                    borderRadius: btnRadius,
                                    boxShadow: currentBtnShadow,
                                }
                            ]}>
                                {testing ? (
                                    <ActivityIndicator size="small" color={isNeu ? nc.textSecondary : colors.onSecondaryContainer} />
                                ) : (
                                    <Animated.Text style={[styles.btnText, { color: secondaryBtnTextColor }]}>
                                        🔌  Test Connection
                                    </Animated.Text>
                                )}
                            </Animated.View>
                        </TouchableOpacity>

                        <View style={styles.btnSpacer} />

                        <TouchableOpacity activeOpacity={0.7} onPress={handleSave} style={styles.buttonHalf}>
                            <Animated.View style={[
                                styles.btn,
                                {
                                    backgroundColor: primaryBtnBg,
                                    borderRadius: btnRadius,
                                    boxShadow: currentBtnShadow,
                                }
                            ]}>
                                <Animated.Text style={[styles.btnText, { color: primaryBtnTextColor }]}>
                                    Save & Connect
                                </Animated.Text>
                            </Animated.View>
                        </TouchableOpacity>
                    </View>

                    {/* ── Test Result ── */}
                    {testResult && (
                        <View style={[
                            styles.testResultContainer,
                            { backgroundColor: testResult.success ? (isDark ? '#1b3a1e' : '#e8f5e9') : (isDark ? '#3a1b1b' : '#fbe9e7') }
                        ]}>
                            <Text style={styles.testResultIcon}>
                                {testResult.success ? '✅' : '❌'}
                            </Text>
                            <Text style={[
                                styles.testResultText,
                                { color: testResult.success ? (isDark ? '#81c784' : '#2e7d32') : (isDark ? '#ef9a9a' : '#c62828') }
                            ]}>
                                {testResult.message}
                            </Text>
                        </View>
                    )}
                </Animated.View>

                {/* ── Theme Toggle Card ── */}
                <Animated.View style={[styles.card, cardAnimStyle, { boxShadow: currentCardShadow }]}>
                    <View style={styles.row}>
                        <View style={styles.rowText}>
                            <Animated.Text style={[styles.cardLabel, { color: headingColor }]}>
                                Neumorphic Theme
                            </Animated.Text>
                            <Animated.Text style={[styles.hintSmall, { color: subtitleColor }]}>
                                Soft, raised UI style
                            </Animated.Text>
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => handleToggleTheme(!isNeu)}
                        >
                            <Animated.View style={[
                                styles.switchTrack,
                                {
                                    backgroundColor: switchTrackBg,
                                    width: switchTrackWidth,
                                    height: switchTrackHeight,
                                    borderRadius: switchTrackRadius,
                                    boxShadow: isNeu ? neuSwitchTrackShadow : noShadow,
                                }
                            ]}>
                                <Animated.View style={[
                                    styles.switchThumb,
                                    {
                                        backgroundColor: switchThumbBg,
                                        width: switchThumbSize,
                                        height: switchThumbSize,
                                        borderRadius: switchThumbRadius,
                                        transform: [{ translateX: switchThumbX }],
                                        boxShadow: isNeu ? neuSwitchThumbShadow : noShadow,
                                    }
                                ]} />
                            </Animated.View>
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* ── Auto Discover Card (settings page only) ── */}
                {onBack && (
                    <Animated.View style={[styles.card, cardAnimStyle, { boxShadow: currentCardShadow }]}>
                        {scanning ? (
                            <View style={styles.scanningContainer}>
                                <ActivityIndicator size="small" color={isNeu ? nc.accent : colors.primary} />
                                <Animated.Text style={[styles.scanningText, { color: subtitleColor }]}>
                                    {scanProgress}
                                </Animated.Text>
                            </View>
                        ) : (
                            <TouchableOpacity activeOpacity={0.7} onPress={handleAutoDiscover}>
                                <Animated.View style={[
                                    styles.btn,
                                    {
                                        backgroundColor: secondaryBtnBg,
                                        borderRadius: btnRadius,
                                        boxShadow: currentBtnShadow,
                                    }
                                ]}>
                                    <Animated.Text style={[styles.btnText, { color: secondaryBtnTextColor }]}>
                                        🔍  Auto Discover Server
                                    </Animated.Text>
                                </Animated.View>
                            </TouchableOpacity>
                        )}
                    </Animated.View>
                )}
            </ScrollView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 48,
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    backBtn: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backIcon: {
        fontSize: 24,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 24,
        paddingBottom: 48,
    },
    heading: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        marginBottom: 24,
    },
    card: {
        padding: 20,
        overflow: 'visible',
    },
    cardLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    hint: {
        fontSize: 13,
        marginBottom: 14,
    },
    hintSmall: {
        fontSize: 13,
        marginTop: 2,
    },
    inputWrapper: {
        marginBottom: 16,
        overflow: 'hidden',
    },
    input: {
        paddingHorizontal: 18,
        paddingVertical: 13,
        fontSize: 16,
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    buttonHalf: {
        flex: 1,
    },
    btnSpacer: {
        width: 10,
    },
    btn: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnText: {
        fontSize: 16,
        fontWeight: '600',
    },
    testResultContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 14,
        padding: 12,
        borderRadius: 12,
    },
    testResultIcon: {
        fontSize: 16,
        marginRight: 8,
        marginTop: 1,
    },
    testResultText: {
        fontSize: 13,
        flex: 1,
        lineHeight: 18,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rowText: {
        flex: 1,
        marginRight: 12,
    },
    switchTrack: {
        justifyContent: 'center',
    },
    switchThumb: {},
    scanningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
    },
    scanningText: {
        marginLeft: 12,
        fontSize: 14,
    },
});
