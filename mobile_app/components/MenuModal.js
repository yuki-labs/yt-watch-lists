import React from 'react';
import { View, StyleSheet, ScrollView, Modal, TouchableOpacity } from 'react-native';
import {
    Portal,
    Dialog,
    TouchableRipple,
    Text,
    Button,
} from 'react-native-paper';
import { getColors, getNeuColors } from '../theme/m3Theme';

export default function MenuModal({ visible, onClose, onOption, video, theme, colorScheme }) {
    if (!video) return null;

    const colors = getColors(colorScheme);
    const nc = getNeuColors(colorScheme);
    const isDark = colorScheme === 'dark';

    const options = [
        { label: 'Edit Title', action: 'edit', icon: '✏️', color: colors.primary, neuColor: nc.accent },
        { label: 'Move to Top', action: 'top', icon: '⬆️', color: colors.onSurface, neuColor: nc.text },
        { label: 'Move Up', action: 'up', icon: '🔼', color: colors.onSurface, neuColor: nc.text },
        { label: 'Move Down', action: 'down', icon: '🔽', color: colors.onSurface, neuColor: nc.text },
        { label: 'Move to Bottom', action: 'bottom', icon: '⬇️', color: colors.onSurface, neuColor: nc.text },
        { label: 'Delete', action: 'delete', icon: '🗑️', color: colors.error, neuColor: nc.danger },
    ];

    const handleOption = (action) => {
        onOption(action, video);
        onClose();
    };

    const isNeumorphic = theme === 'neumorphic';

    // ─── Neumorphic dialog ───
    if (isNeumorphic) {
        const neuModalShadow = [
            { offsetX: 12, offsetY: 12, blurRadius: 24, spreadDistance: 0, color: `${nc.shadowDark}0.6)` },
            { offsetX: -12, offsetY: -12, blurRadius: 24, spreadDistance: 0, color: `${nc.shadowLight}0.8)` },
        ];
        const neuOptionBtnShadow = [
            { offsetX: 4, offsetY: 4, blurRadius: 8, spreadDistance: 0, color: `${nc.shadowDark}0.45)` },
            { offsetX: -4, offsetY: -4, blurRadius: 8, spreadDistance: 0, color: `${nc.shadowLight}0.65)` },
        ];
        const neuContainerInsetShadow = [
            { offsetX: 4, offsetY: 4, blurRadius: 10, spreadDistance: 0, color: `${nc.shadowDark}0.5)`, inset: true },
            { offsetX: -4, offsetY: -4, blurRadius: 10, spreadDistance: 0, color: `${nc.shadowLight}0.7)`, inset: true },
        ];
        const neuCancelBtnShadow = [
            { offsetX: 3, offsetY: 3, blurRadius: 6, spreadDistance: 0, color: `${nc.shadowDark}0.4)` },
            { offsetX: -3, offsetY: -3, blurRadius: 6, spreadDistance: 0, color: `${nc.shadowLight}0.6)` },
        ];
        const neuContainerBg = isDark ? '#222529' : '#d6dbe2';

        return (
            <Modal
                animationType="fade"
                transparent={true}
                visible={visible}
                onRequestClose={onClose}
            >
                <TouchableOpacity style={neuStyles.overlay} onPress={onClose} activeOpacity={1}>
                    <View style={[neuStyles.modalView, { backgroundColor: nc.base, boxShadow: neuModalShadow }]}>
                        <Text style={[neuStyles.title, { color: nc.text }]}>{video.title}</Text>
                        <ScrollView>
                            <View style={[neuStyles.optionContainer, { backgroundColor: neuContainerBg, boxShadow: neuContainerInsetShadow }]}>
                                {options.map((opt, i) => (
                                    <TouchableOpacity
                                        key={opt.action}
                                        style={[neuStyles.optionBtn, { backgroundColor: nc.base, boxShadow: neuOptionBtnShadow }]}
                                        onPress={() => handleOption(opt.action)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={sharedStyles.optionRow}>
                                            <Text style={neuStyles.optionIcon}>{opt.icon}</Text>
                                            <Text style={[neuStyles.optionText, { color: opt.neuColor }]}>
                                                {opt.label}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                        <TouchableOpacity
                            style={[neuStyles.cancelBtn, { backgroundColor: nc.base, boxShadow: neuCancelBtnShadow }]}
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Text style={[neuStyles.cancelText, { color: nc.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    }

    // ─── M3 Expressive Dialog ───
    return (
        <Portal>
            <Dialog
                visible={visible}
                onDismiss={onClose}
                style={[m3Styles.dialog, { backgroundColor: colors.surfaceContainerHigh }]}
            >
                <Dialog.ScrollArea style={m3Styles.scrollArea}>
                    <ScrollView contentContainerStyle={m3Styles.optionList}>
                        <View style={[m3Styles.titleCapsule, { backgroundColor: colors.primaryContainer }]}>
                            <Text style={[m3Styles.title, { color: colors.onPrimaryContainer }]}>{video.title}</Text>
                        </View>
                        {options.map((opt) => (
                            <TouchableRipple
                                key={opt.action}
                                onPress={() => handleOption(opt.action)}
                                rippleColor={colors.primaryContainer}
                                style={[m3Styles.optionCapsule, { backgroundColor: colors.surfaceContainerLow }]}
                                borderless
                            >
                                <View style={sharedStyles.optionRow}>
                                    <Text style={m3Styles.optionIcon}>{opt.icon}</Text>
                                    <Text
                                        variant="bodyLarge"
                                        style={[m3Styles.optionText, { color: opt.color }]}
                                    >
                                        {opt.label}
                                    </Text>
                                </View>
                            </TouchableRipple>
                        ))}
                    </ScrollView>
                </Dialog.ScrollArea>
                <Dialog.Actions style={m3Styles.actions}>
                    <Button
                        mode="text"
                        onPress={onClose}
                        textColor={colors.onSurfaceVariant}
                    >
                        Cancel
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
}

// ── Shared Styles ──
const sharedStyles = StyleSheet.create({
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

// ── M3 Styles ──
const m3Styles = StyleSheet.create({
    dialog: {
        borderRadius: 28,
        maxHeight: '70%',
    },
    title: {
        fontWeight: '600',
        fontSize: 16,
        textAlign: 'center',
    },
    titleCapsule: {
        borderRadius: 50,
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    scrollArea: {
        paddingHorizontal: 0,
        borderTopWidth: 0,
        borderBottomWidth: 0,
    },
    optionList: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
    },
    optionCapsule: {
        borderRadius: 50,
        paddingVertical: 14,
        paddingHorizontal: 20,
        overflow: 'hidden',
    },
    optionIcon: {
        fontSize: 18,
        marginRight: 16,
    },
    optionText: {
        fontWeight: '500',
    },
    actions: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
});

// ── Neumorphic Styles ──
const neuStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalView: {
        width: '82%',
        borderRadius: 20,
        padding: 24,
        maxHeight: '80%',
        overflow: 'visible',
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 18,
        textAlign: 'center',
    },
    optionContainer: {
        borderRadius: 14,
        padding: 10,
        gap: 6,
        marginBottom: 10,
        overflow: 'visible',
    },
    optionBtn: {
        paddingVertical: 11,
        paddingHorizontal: 10,
        borderRadius: 10,
        overflow: 'visible',
    },
    optionIcon: {
        fontSize: 16,
        marginRight: 12,
    },
    optionText: {
        fontSize: 15,
        fontWeight: '600',
    },
    cancelBtn: {
        marginTop: 10,
        borderRadius: 50,
        paddingVertical: 12,
        alignItems: 'center',
        overflow: 'visible',
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
