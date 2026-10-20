/**
 * @format
 */

import { AppRegistry } from 'react-native'
import App from './App'
import { name as appName } from './app.json'
import { startMonitoring, withMonitoring } from './src/lib/monitoring'

// Before anything renders, so a crash on start is reported too.
startMonitoring()

AppRegistry.registerComponent(appName, () => withMonitoring(App))
