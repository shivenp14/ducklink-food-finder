import { useState, useEffect } from 'react'
import HomeScreen from './screens/HomeScreen'
import ScanningScreen from './screens/ScanningScreen'
import ResultsScreen from './screens/ResultsScreen'
import SettingsScreen from './screens/SettingsScreen'
import { useScan } from './hooks/useScan'

import Layout from './components/layout/Layout'

type Screen = 'home' | 'scanning' | 'results' | 'settings'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const scan = useScan()

  useEffect(() => {
    if (scan.state === 'scanning' || scan.state === 'error') {
      setScreen('scanning')
    }
    if (scan.state === 'done' && scan.events.length === 0) {
      setScreen('results')
    }
    if (scan.state === 'done' && scan.events.length > 0) {
      setScreen('results')
    }
  }, [scan.state, scan.events])

  return (
    <Layout currentScreen={screen} onNavigate={setScreen}>
      {screen === 'home' && (
        <HomeScreen
          onScan={() => {
            scan.startScan()
            setScreen('scanning')
          }}
          onLoadCached={() => {
            scan.startScan()
          }}
          onSettings={() => setScreen('settings')}
        />
      )}
      {screen === 'scanning' && (
        <ScanningScreen
          state={scan.state}
          progress={scan.progress}
          error={scan.error}
          onCancel={() => {
            scan.cancelScan()
            setScreen('home')
          }}
          onRetry={() => {
            scan.reset()
            scan.startScan()
          }}
          onBack={() => {
            scan.reset()
            setScreen('home')
          }}
        />
      )}
      {screen === 'results' && (
        <ResultsScreen
          events={scan.events}
          foodEvents={scan.foodEvents}
          fromCache={scan.fromCache}
          onRescan={() => {
            scan.reset()
            scan.startScan()
            setScreen('scanning')
          }}
          onRefresh={() => {
            scan.reset()
            scan.startScan(true)
            setScreen('scanning')
          }}
          onHome={() => {
            scan.reset()
            setScreen('home')
          }}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen onBack={() => setScreen('home')} />
      )}
    </Layout>
  )
}
