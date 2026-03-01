import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, TextInput as RNTextInput, Button as RNButton } from 'react-native';
import {
    Portal,
    Dialog,
    TextInput,
    Button,
    Text,
} from 'react-native-paper';
import { getColors, getNeuColors } from '../theme/m3Theme';

export default function EditTitleModal({ visible, onClose, onSave, video, theme, colorScheme }) {
    const [title, setTitle] = useState('');

    const colors = getColors(colorScheme);
    const nc = getNeuColors(colorScheme);

    useEffect(() => {
        if (video) setTitle(video.title);
    }, [video]);

    const handleSave = () => {
        if (title.trim()) {
            onSave(video.id, title.trim());
            onClose();
        }
    };

    // ─── Neumorphic fallback ───
    if (theme === 'neumorphic') {
        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={visible}
                onRequestClose={onClose}
            >
                <View style={neuStyles.centeredView}>
                    <View style={[neuStyles.modalView, { backgroundColor: nc.base }]}>
                        <Text style={[neuStyles.modalTitle, { color: nc.text }]}>Edit Title</Text>
                        <RNTextInput
                            style={[neuStyles.input, { backgroundColor: nc.base, color: nc.text }]}
                            value={title}
                            onChangeText={setTitle}
                            autoFocus={true}
                            multiline={true}
                            placeholderTextColor={nc.placeholderText}
                        />
                        <View style={neuStyles.buttons}>
                            <RNButton title="Cancel" onPress={onClose} color={nc.textSecondary} />
                            <RNButton title="Save" onPress={handleSave} color={nc.accent} />
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
                style={[m3Styles.dialog, { backgroundColor: colors.surfaceContainerHigh }]}
            >
                <Dialog.Title style={[m3Styles.title, { color: colors.onSurface }]}>Edit Title</Dialog.Title>
                <Dialog.Content>
                    <TextInput
                        mode="outlined"
                        label="Video title"
                        value={title}
                        onChangeText={setTitle}
                        multiline={true}
                        numberOfLines={3}
                        style={[m3Styles.input, { backgroundColor: colors.surfaceContainerHigh }]}
                        outlineStyle={m3Styles.inputOutline}
                        activeOutlineColor={colors.primary}
                        outlineColor={colors.outlineVariant}
                        textColor={colors.onSurface}
                    />
                </Dialog.Content>
                <Dialog.Actions style={m3Styles.actions}>
                    <Button
                        mode="text"
                        onPress={onClose}
                        textColor={colors.onSurfaceVariant}
                    >
                        Cancel
                    </Button>
                    <Button
                        mode="contained"
                        onPress={handleSave}
                        buttonColor={colors.primary}
                        textColor={colors.onPrimary}
                        style={m3Styles.saveBtn}
                    >
                        Save
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
}

// ── M3 Styles ──
const m3Styles = StyleSheet.create({
    dialog: {
        borderRadius: 28,
    },
    title: {
        fontWeight: '600',
    },
    input: {
        minHeight: 80,
    },
    inputOutline: {
        borderRadius: 16,
    },
    actions: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    saveBtn: {
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
        borderRadius: 15,
        paddingVertical: 10,
        paddingHorizontal: 20,
        marginBottom: 20,
        fontSize: 16,
        minHeight: 80,
        textAlignVertical: 'top',
        borderWidth: 0,
    },
    buttons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
});
