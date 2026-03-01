import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
    Portal,
    Dialog,
    TextInput,
    Button,
    Text,
} from 'react-native-paper';
import { getColors, getNeuColors } from '../theme/m3Theme';

export default function AddVideoModal({ visible, onClose, onAdd, theme, colorScheme }) {
    const [url, setUrl] = useState('');

    const colors = getColors(colorScheme);
    const nc = getNeuColors(colorScheme);

    const handleAdd = () => {
        if (url.trim()) {
            onAdd(url.trim());
            setUrl('');
            onClose();
        }
    };

    const isNeumorphic = theme === 'neumorphic';

    // ─── Neumorphic fallback (plain RN Modal) ───
    if (isNeumorphic) {
        const { Modal, TextInput: RNTextInput, Button: RNButton } = require('react-native');
        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={visible}
                onRequestClose={onClose}
            >
                <View style={neuStyles.centeredView}>
                    <View style={[neuStyles.modalView, { backgroundColor: nc.base }]}>
                        <Text style={[neuStyles.modalTitle, { color: nc.text }]}>Add Video Link</Text>
                        <RNTextInput
                            style={[neuStyles.input, { backgroundColor: nc.base, color: nc.text }]}
                            placeholder="Paste YouTube Link"
                            value={url}
                            onChangeText={setUrl}
                            autoCapitalize="none"
                            placeholderTextColor={nc.placeholderText}
                        />
                        <View style={neuStyles.buttons}>
                            <RNButton title="Cancel" onPress={onClose} color={nc.textSecondary} />
                            <RNButton title="Add" onPress={handleAdd} color={nc.accent} />
                        </View>
                    </View>
                </View>
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
                <Dialog.Title style={[styles.title, { color: colors.onSurface }]}>Add Video Link</Dialog.Title>
                <Dialog.Content>
                    <TextInput
                        mode="outlined"
                        label="YouTube URL"
                        placeholder="Paste YouTube Link"
                        value={url}
                        onChangeText={setUrl}
                        autoCapitalize="none"
                        style={[styles.input, { backgroundColor: colors.surfaceContainerHigh }]}
                        outlineStyle={styles.inputOutline}
                        activeOutlineColor={colors.primary}
                        outlineColor={colors.outlineVariant}
                        textColor={colors.onSurface}
                    />
                </Dialog.Content>
                <Dialog.Actions style={styles.actions}>
                    <Button
                        mode="text"
                        onPress={() => { setUrl(''); onClose(); }}
                        textColor={colors.onSurfaceVariant}
                    >
                        Cancel
                    </Button>
                    <Button
                        mode="contained"
                        onPress={handleAdd}
                        buttonColor={colors.primary}
                        textColor={colors.onPrimary}
                        style={styles.addBtn}
                    >
                        Add
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
    },
    title: {
        fontWeight: '600',
    },
    input: {},
    inputOutline: {
        borderRadius: 16,
    },
    actions: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    addBtn: {
        borderRadius: 28,
        marginLeft: 8,
    },
});

// ── Neumorphic Styles ──
const neuStyles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        width: '90%',
        borderRadius: 20,
        padding: 20,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    input: {
        borderRadius: 50,
        paddingHorizontal: 20,
        padding: 10,
        marginBottom: 20,
        fontSize: 16,
        borderWidth: 0,
    },
    buttons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
});
