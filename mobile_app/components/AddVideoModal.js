import React, { useState } from 'react';
import { View, Text, Modal, TextInput, Button, StyleSheet } from 'react-native';

export default function AddVideoModal({ visible, onClose, onAdd }) {
    const [url, setUrl] = useState('');

    const handleAdd = () => {
        if (url.trim()) {
            onAdd(url.trim());
            setUrl('');
            onClose();
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>Add Video Link</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Paste YouTube Link"
                        value={url}
                        onChangeText={setUrl}
                        autoCapitalize="none"
                    />
                    <View style={styles.buttons}>
                        <Button title="Cancel" onPress={onClose} color="#999" />
                        <Button title="Add" onPress={handleAdd} />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        width: '90%',
        backgroundColor: 'white',
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
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 10,
        marginBottom: 20,
        fontSize: 16,
    },
    buttons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
});
