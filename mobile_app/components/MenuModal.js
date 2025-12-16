import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function MenuModal({ visible, onClose, onOption, video }) {
    if (!video) return null;

    const options = [
        { label: 'Edit Title', action: 'edit', color: '#007bff' },
        { label: 'Move to Top', action: 'top', color: '#333' },
        { label: 'Move Up', action: 'up', color: '#333' },
        { label: 'Move Down', action: 'down', color: '#333' },
        { label: 'Move to Bottom', action: 'bottom', color: '#333' },
        { label: 'Delete', action: 'delete', color: '#dc3545' },
    ];

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
                <View style={styles.modalView}>
                    <Text style={styles.title} numberOfLines={1}>Actions for: {video.title}</Text>
                    <ScrollView>
                        {options.map((opt, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.option}
                                onPress={() => {
                                    onOption(opt.action, video);
                                    onClose();
                                }}
                            >
                                <Text style={[styles.optionText, { color: opt.color }]}>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalView: {
        width: '80%',
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        elevation: 5,
        maxHeight: '80%',
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
        color: '#333',
    },
    option: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        alignItems: 'center',
    },
    optionText: {
        fontSize: 16,
        fontWeight: '500',
    },
    cancelBtn: {
        marginTop: 15,
        padding: 10,
        alignItems: 'center',
    },
    cancelText: {
        color: '#666',
        fontSize: 16,
    },
});
