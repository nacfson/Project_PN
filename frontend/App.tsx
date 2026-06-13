import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { ManualAddScreen } from './src/screens/ManualAddScreen';

type Tab = 'capture' | 'manual';

export default function App() {
  const [tab, setTab] = useState<Tab>('capture');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.brand}>Project PN</Text>
        <Text style={styles.subtitle}>Add words you do not know</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          onPress={() => setTab('capture')}
          style={[styles.tab, tab === 'capture' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, tab === 'capture' && styles.tabLabelActive]}>Capture</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab('manual')}
          style={[styles.tab, tab === 'manual' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, tab === 'manual' && styles.tabLabelActive]}>Manual Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {tab === 'capture' ? <CaptureScreen /> : <ManualAddScreen />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
  },
  tabActive: {
    backgroundColor: '#1e293b',
  },
  tabLabel: {
    fontWeight: '600',
    color: '#475569',
  },
  tabLabelActive: {
    color: '#ffffff',
  },
  body: {
    flex: 1,
  },
});
