import React from 'react';
import { View, StyleSheet, ScrollView, Modal, TouchableOpacity } from 'react-native';
import {
    Portal,
    Dialog,
    TouchableRipple,
    Text,
    Divider,
    Button,
} from 'react-native-paper';
import { getColors, getNeuColors } from '../theme/m3Theme';

export default function MenuModal({ visible, onClose, onOption, video, theme, colorScheme }) {
    if (!video) return null;

    const colors = getColors(colorScheme);
    const nc = getNeuColors(colorScheme);

    const options = [
        { label: 'Edit Title', action: 'edit', icon: '✏️', color: colors.primary, neuColor: nc.accent },
        { label: 'Move to Top', action: 'top', icon: '⬆️', color: colors.onSurface, neuColor: nc.text },
        { label: 'Move Up', action: 'up', icon: '🔼', color: colors.onSurface, neuColor: nc.text },
        { label: 'Move Down', action: 'down', icon: '🔽', color: colors.onSurface, neuColor: nc.text },
        { label: 'Move to Bottom', action: 'bottom', icon: '⬇️', color: colors.onSurface, neuColor: nc.text },
        { label: 'Delete', action: 'delete', icon: '🗑️', color: colors.error, neuColor: nc.danger },
    ];

    const isNeumorphic = theme === 'neumorphic';

    // ── Neumorphic shadows (dynamic) ──
    const neuModalShadow = [
        { offsetX: 12, offsetY: 12, blurRadius: 24, spreadDistance: 0, color: `${nc.shadowDark}0.6)` },
        { offsetX: -12, offsetY: -12, blurRadius: 24, spreadDistance: 0, color: `${nc.shadowLight}0.8)` },
    ];
    const neuOptionBtnShadow = [
        { offsetX: 4, offsetY: 4, blurRadius: 8, spreadDistance: 0, color: `${nc.shadowDark}0.45)` },
        { offsetX: -4, offsetY: -4, blurRadius: 8, spreadDistance: 0, color: `${nc.shadowLight}0.65)` },
    ];
    const neuMoveContainerInsetShadow = [
        { offsetX: 4, offsetY: 4, blurRadius: 10, spreadDistance: 0, color: `${nc.shadowDark}0.5)`, inset: true },
        { offsetX: -4, offsetY: -4, blurRadius: 10, spreadDistance: 0, color: `${nc.shadowLight}0.7)`, inset: true },
    ];
    const neuCancelBtnShadow = [
        { offsetX: 3, offsetY: 3, blurRadius: 6, spreadDistance: 0, color: `${nc.shadowDark}0.4)` },
        { offsetX: -3, offsetY: -3, blurRadius: 6, spreadDistance: 0, color: `${nc.shadowLight}0.6)` },
    ];

    const isDark = colorScheme === 'dark';
    const neuContainerBg = isDark ? '#222529' : '#d6dbe2';

    // ─── Neumorphic dialog ───
    if (isNeumorphic) {
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
                            {/* All options — inset container */}
                            <View style={[neuStyles.moveContainer, { backgroundColor: neuContainerBg, boxShadow: neuMoveContainerInsetShadow }]}>
                                {options.map((opt, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={[neuStyles.moveOption, { backgroundColor: nc.base, boxShadow: neuOptionBtnShadow }]}
                                        onPress={() => { onOption(opt.action, video); onClose(); }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={neuStyles.optionRow}>
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
                style={[styles.dialog, { backgroundColor: colors.surfaceContainerHigh }]}
            >
                <Dialog.ScrollArea style={styles.scrollArea}>
                    <ScrollView contentContainerStyle={styles.optionList}>
                        <View style={[styles.titleCapsule, { backgroundColor: colors.primaryContainer }]}>
                            <Text style={[styles.title, { color: colors.onPrimaryContainer }]}>{video.title}</Text>
                        </View>
                        {options.map((opt, index) => (
                            <TouchableRipple
                                key={index}
                                onPress={() => { onOption(opt.action, video); onClose(); }}
                                rippleColor={colors.primaryContainer}
                                style={[styles.optionCapsule, { backgroundColor: colors.surfaceContainerLow }]}
                                borderless
                            >
                                <View style={styles.optionRow}>
                                    <Text style={styles.optionIcon}>{opt.icon}</Text>
                                    <Text
                                        variant="bodyLarge"
                                        style={[styles.optionText, { color: opt.color }]}
                                    >
                                        {opt.label}
                                    </Text>
                                </View>
                            </TouchableRipple>
                        ))}
                    </ScrollView>
                </Dialog.ScrollArea>
                <Dialog.Actions style={styles.actions}>
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

// ── M3 Expressive Styles ──
const styles = StyleSheet.create({
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
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    optionIcon: {
        fontSize: 18,
        marginRight: 16,
    },
    optionText: {
        fontWeight: '500',
    },
    divider: {
        marginHorizontal: 24,
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
    moveContainer: {
        borderRadius: 14,
        padding: 10,
        gap: 6,
        marginBottom: 10,
        overflow: 'visible',
    },
    moveOption: {
        paddingVertical: 11,
        paddingHorizontal: 10,
        borderRadius: 10,
        overflow: 'visible',
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
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
