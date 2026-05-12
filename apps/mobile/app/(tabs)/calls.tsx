import { SafeAreaView, Text, View, StyleSheet } from 'react-native'

export default function CallsTab() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Calls</Text>
        <Text style={styles.body}>
          1-on-1 session booking is managed on the Mento web app for MVP.
        </Text>
        <Text style={styles.hint}>
          Visit mento.app on a desktop browser to book or manage sessions.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
})
