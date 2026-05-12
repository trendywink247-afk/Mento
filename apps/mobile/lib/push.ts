import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { getApiClient } from './api'

const PUSH_TOKEN_KEY = 'mento:pushToken'

/**
 * Requests notification permissions, obtains the Expo push token, and
 * registers it with the Mento API.  Safe to call repeatedly — upserts on
 * the server side.  Errors are swallowed so they never block sign-in.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    // Expo push tokens only work on physical devices.
    if (!Device.isDevice) {
      console.log('[push] Skipping registration — not a physical device')
      return
    }

    // Ask for permissions (will no-op if already granted or denied).
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') {
      console.log('[push] Notifications permission not granted')
      return
    }

    // Resolve the EAS project ID from app config, falling back gracefully.
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
    const token = tokenData.data

    // Map React Native platform to our enum.
    const platform: 'IOS' | 'ANDROID' | 'WEB' =
      Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB'

    await getApiClient().pushTokens.register(token, platform)

    // Persist the token so logout can delete it from the server.
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token)
  } catch (err) {
    // Non-fatal — push failures must never block auth flows.
    console.warn('[push] Registration failed:', err)
  }
}

/**
 * Removes the stored push token from the server and clears it locally.
 * Call this during logout.
 */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY)
    if (!token) return
    await getApiClient().pushTokens.unregister(token)
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY)
  } catch (err) {
    // Non-fatal — let logout proceed regardless.
    console.warn('[push] Unregister failed:', err)
  }
}
