import React from 'react';
import {Modal, ScrollView, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors, radius, spacing} from './theme';

export default function ReviewModal({visible, onClose, children}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: 'rgba(20, 25, 18, 0.65)', justifyContent: 'center', padding: spacing(2.5)},
  sheet: {backgroundColor: colors.bg, borderRadius: radius.lg, maxHeight: '90%', width: '100%', maxWidth: 560, alignSelf: 'center', overflow: 'hidden'},
  content: {padding: spacing(3), gap: spacing(1.5)},
});
