/**
 * AppDialog — A modern, premium dark-themed dialog to replace
 * all native Alert.alert() calls across the GreyAdz app.
 *
 * Usage:
 *   const { showDialog, DialogComponent } = useDialog();
 *
 *   // Simple info alert
 *   showDialog({ title: 'Error', message: 'Something went wrong' });
 *
 *   // Confirmation with actions
 *   showDialog({
 *     title: 'Sign Out',
 *     message: 'Are you sure?',
 *     buttons: [
 *       { label: 'Cancel', style: 'cancel' },
 *       { label: 'Sign Out', style: 'destructive', onPress: () => logout() },
 *     ],
 *   });
 *
 *   // Then render in your component: {DialogComponent}
 */

import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';

const { width: SCREEN_W } = Dimensions.get('window');

export type DialogButton = {
  label: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type DialogConfig = {
  title: string;
  message?: string;
  icon?: string; // emoji
  buttons?: DialogButton[];
};

type DialogState = DialogConfig & { visible: boolean };

const DEFAULT_BUTTONS: DialogButton[] = [{ label: 'OK', style: 'default' }];

function AppDialog({
  state,
  onDismiss,
}: {
  state: DialogState;
  onDismiss: () => void;
}) {
  const buttons = state.buttons?.length ? state.buttons : DEFAULT_BUTTONS;

  const handlePress = (btn: DialogButton) => {
    onDismiss();
    if (btn.onPress) setTimeout(btn.onPress, 150);
  };

  const isDestructive =
    state.title.toLowerCase().includes('delete') ||
    state.title.toLowerCase().includes('sign out') ||
    state.title.toLowerCase().includes('remove');

  const iconEmoji =
    state.icon ||
    (isDestructive
      ? '⚠️'
      : state.title.toLowerCase().includes('success') ||
        state.title.toLowerCase().includes('sent') ||
        state.title.toLowerCase().includes('updated')
      ? '✅'
      : state.title.toLowerCase().includes('error') ||
        state.title.toLowerCase().includes('fail') ||
        state.title.toLowerCase().includes('invalid')
      ? '❌'
      : 'ℹ️');

  return (
    <Modal
      visible={state.visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconWrap}>
            <Text style={styles.iconEmoji}>{iconEmoji}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{state.title}</Text>

          {/* Message */}
          {!!state.message && (
            <Text style={styles.message}>{state.message}</Text>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Buttons */}
          <View style={[styles.btnRow, buttons.length > 2 && { flexDirection: 'column' }]}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.btn,
                  btn.style === 'destructive' && styles.btnDestructive,
                  btn.style === 'cancel' && styles.btnCancel,
                  btn.style === 'default' && styles.btnDefault,
                  buttons.length > 2 && { flex: undefined, width: '100%' },
                ]}
                onPress={() => handlePress(btn)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.btnText,
                    btn.style === 'destructive' && styles.btnTextDestructive,
                    btn.style === 'cancel' && styles.btnTextCancel,
                  ]}
                >
                  {btn.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function useDialog() {
  const [state, setState] = useState<DialogState>({
    visible: false,
    title: '',
    message: undefined,
    buttons: undefined,
  });

  const showDialog = useCallback((config: DialogConfig) => {
    setState({ ...config, visible: true });
  }, []);

  const dismiss = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const DialogComponent = (
    <AppDialog state={state} onDismiss={dismiss} />
  );

  return { showDialog, DialogComponent };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 30,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconEmoji: {
    fontSize: 26,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  message: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 4,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 18,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDefault: {
    backgroundColor: '#FFFFFF',
  },
  btnCancel: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  btnDestructive: {
    backgroundColor: '#EF4444',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  btnTextCancel: {
    color: '#A1A1AA',
  },
  btnTextDestructive: {
    color: '#FFF',
  },
});
