import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TextInput, Button, StyleSheet } from 'react-native';

export default function EditTitleModal({ visible, onClose, onSave, video }) {
    const [title, setTitle] = useState('');

    useEffect(() => {
        if (video) setTitle(video.title);
    }, [video]);

    const handleSave = () => {
        if (title.trim()) {
            onSave(video.id, title.trim());
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
                    <Text style={styles.modalTitle}>Edit Title</Text>
                    <TextInput
                        style={styles.input}
                        value={title}
                        onChangeText={setTitle}
                        autoFocus={true}
                        multiline={true}
                    />
                    <View style={styles.buttons}>
                        <Button title="Cancel" onPress={onClose} color="#999" />
                        <Button title="Save" onPress={handleSave} />
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
        minHeight: 80,
        textAlignVertical: 'top',
    },
    buttons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
});
