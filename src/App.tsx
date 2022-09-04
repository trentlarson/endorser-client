// Created from the setup in https://veramo.io/docs/guides/react_native

import 'react-native-gesture-handler'
import 'reflect-metadata'

import { classToPlain } from 'class-transformer'
import notifee, { AuthorizationStatus, EventType, TriggerType } from '@notifee/react-native';
import React, { useEffect, useState } from 'react'
import { Button, Linking, Modal, NativeModules, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native'
import { requestNotifications } from 'react-native-permissions'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/FontAwesome'
import VersionNumber from 'react-native-version-number'
import { NavigationContainer, StackActions } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { Provider, useSelector } from 'react-redux'

import * as pkg from '../package.json'
import { MASTER_COLUMN_VALUE, Settings } from './entity/settings'
import { styles } from './screens/style'

import { HandyConstructCredentialScreen } from './screens/HandyConstructCredential'
import { HandyContactsScreen } from './screens/HandyContacts'
import { HandyInitializeScreen } from './screens/HandyInitialize'
import { HandyExportIdentityScreen, HandyImportIdentityScreen, HandySettingsScreen } from "./screens/HandySettings";
import { HandyReviewToSignCredentialScreen } from './screens/HandyReviewToSignCredential'
import { HandyScanPresentationScreen, HandyVerifyCredentialScreen } from './screens/HandyVerifyCredential'
import { HandySignCredentialScreen } from './screens/HandySignSendToEndorser'

/**
import { ConfirmOthersScreen } from './screens/ConfirmOthers.tsx'
import { ContactImportScreen } from './screens/ContactImportScan.tsx'
import { MyCredentialsScreen } from './screens/MyCredentials'
import { MyGivenScreen } from './screens/MyGiven'
import { MyOffersScreen } from './screens/MyOffers'
import { NotificationPermissionsScreen } from './screens/NotificationPermissions'
import { PresentCredentialScreen } from './screens/PresentCredential'
import { ReportFeedScreen } from './screens/ReportFeed'
import { ReportScreen } from './screens/ReportFromEndorser'
import { ScanAnythingScreen } from './screens/ScanAnything'
**/

import { appSlice, appStore, DEFAULT_ENDORSER_API_SERVER } from './veramo/appSlice'
import { agent, dbConnection } from './veramo/setup'
import * as utility from './utility/utility.ts'
import { BVCButton } from './utility/utility.tsx'





/****************************************************************

 Screens

 ****************************************************************/


const Stack = createStackNavigator();

export default function App() {

  return (
    <Provider store={ appStore }>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Community Endorser" component={HomeScreen} />
            <Stack.Screen name="Contacts" component={HandyContactsScreen} />
            <Stack.Screen name="Create Credential" component={HandyConstructCredentialScreen} />
            <Stack.Screen name="Help" component={HandyHelpScreen} />
            <Stack.Screen name="Export Seed Phrase" component={HandyExportIdentityScreen} />
            <Stack.Screen name="Import Seed Phrase" component={HandyImportIdentityScreen} />
            <Stack.Screen name="Initialize" component={HandyInitializeScreen} />
            <Stack.Screen name="Scan Presentation" component={HandyScanPresentationScreen} />
            <Stack.Screen name="Settings" component={HandySettingsScreen} />
            <Stack.Screen name="Verify Credential" component={HandyVerifyCredentialScreen} />
            <Stack.Screen name="Review & Sign" component={HandyReviewToSignCredentialScreen} />
            <Stack.Screen name="Signature Results" component={HandySignCredentialScreen} />

            {/**
            <Stack.Screen name="Confirm Others" component={ConfirmOthersScreen} />
            <Stack.Screen name="Contact Import" component={ContactImportScreen} />
            <Stack.Screen name="Notification Permissions" component={NotificationPermissionsScreen} />
            <Stack.Screen name="Present Credential" component={PresentCredentialScreen} />
            <Stack.Screen name="Report Claims Feed" component={ReportFeedScreen} />
            <Stack.Screen name="Reports from Endorser server" component={ReportScreen} />
            <Stack.Screen name="Scan Content" component={ScanAnythingScreen} />
            <Stack.Screen name="Your Credentials" component={MyCredentialsScreen} />
            <Stack.Screen name="Your Given" component={MyGivenScreen} />
            <Stack.Screen name="Your Offers" component={MyOffersScreen} />
            **/}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  )
}

function HomeScreen({ navigation }) {

  const [initError, setInitError] = useState<string>()
  const [loading, setLoading] = useState<boolean>(true)
  const [quickMessage, setQuickMessage] = useState<string>(null)

  const allIdentifiers = useSelector((state) => state.identifiers)
  const settings = useSelector((state) => state.settings)

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getIdentifiers = async () => {
      appStore.dispatch(appSlice.actions.addLog({log: true, msg: "About to load DIDs..."}))

      try {

        // Initialize DB, eg. settings.

        const _ids = await agent.didManagerFind()

        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... found DIDs, about to store..."}))
        appStore.dispatch(appSlice.actions.setIdentifiers(_ids.map(classToPlain)))
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... stored DIDs, about to load settings ..."}))

        const conn = await dbConnection
        let settings = await conn.manager.findOne(Settings, MASTER_COLUMN_VALUE)
        if (!settings) {
          const initSettings = { id: MASTER_COLUMN_VALUE, apiServer: DEFAULT_ENDORSER_API_SERVER }
          settings = await conn.manager.save(Settings, initSettings)
        } else if (!settings.apiServer) {
          settings.apiServer = DEFAULT_ENDORSER_API_SERVER
          settings = await conn.manager.save(Settings, settings)
        }
        appStore.dispatch(appSlice.actions.setSettings(classToPlain(settings)))
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... loaded settings, about to load contacts..."}))

        await utility.loadContacts(appSlice, appStore, dbConnection)
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... finished loading contacts."}))

        setLoading(false)

      } catch (err) {
        console.log('Got error on initial App useEffect:', err)
        appStore.dispatch(appSlice.actions.addLog({log: true, msg: "... got an error: " + err}))
        setInitError('Something went wrong during initialization. Kindly send us the logs (near the bottom of Help).')
      }


    }
    getIdentifiers()
  }, [])

  return (
    <SafeAreaView>
      <ScrollView>
        {
        loading
        ?
          <View style={{ marginTop: '50%', marginLeft: '45%'}}>
            <Text>Loading...</Text>
          </View>
        :
          <View />
        }

        {
        initError
        ?
          <View style={{ marginTop: '50%', marginLeft: '10%', marginRight: '10%' }}>
            <Text style={{ color: 'red' }}>{initError}</Text>
          </View>
        :
          <View />
        }

        {
          allIdentifiers != null && allIdentifiers.length > 0
          ? (
            <View>
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Sign Contract"
                onPress={() => navigation.navigate('Create Credential')}
              />
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Verify Someone Else's Signature"
                onPress={() => navigation.navigate('Scan Presentation')}
              />
              <View style={{ marginTop: 50 }}/>
              <Button
                title="Contacts"
                onPress={() => navigation.navigate('Contacts')}
              />
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Settings"
                onPress={() => navigation.navigate('Settings')}
              />
            </View>
          ) : ( // there are no identifiers
            <View>
              <Button
                title="Initialize New Wallet"
                onPress={() => navigation.navigate('Initialize')}
              />
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Import Previous Wallet"
                onPress={() => navigation.navigate('Import Seed Phrase')}
              />
              <View style={{ marginTop: 5 }}/>
              <Button
                title="Verify Someone Else's Signature"
                onPress={() => navigation.navigate('Scan Presentation')}
              />
            </View>
          )
        }
        <View style={{ marginTop: 5 }}/>
        <Button
          title="Help"
          onPress={() => navigation.navigate('Help')}
        />

      <Modal
        animationType="slide"
        transparent={true}
        visible={!!quickMessage}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text>{ quickMessage }</Text>
          </View>
        </View>
      </Modal>

      </ScrollView>
    </SafeAreaView>
  )
}

function HandyHelpScreen() {

  const logMessageSelector = useSelector((state) => state.logMessage)

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>This allows you to create Verified Credentials that you can apply to your contracts.</Text>
          <Text style={{ padding: 5 }}>This uses the power of cryptography to build confidence: when you make claims and then your friends and family confirm those claims, you gain much more utility, control, and security in your online life.</Text>
          <Text style={{ padding: 5 }}>For an example, look at <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://endorser.ch/reportBestAttendance')}>this report of meeting attendance on the Endorser server</Text>.  Attendees can see their own info and their contacts' info but you cannot see it... until someone brings you into their confidence. So make some claims, confirm others' claims, and build a network of trust -- with trustworthy communifcations, all verifiable cryptographically.</Text>
          <Text style={{ padding: 5, color: 'blue' }} onPress={() => Linking.openURL('https://endorser.ch/docs')}>For more info, see the Docs section on the Endorser server.</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>What data is visible to others?</Text>
          <Text style={{ padding: 5 }}>All data that you enter except for your ID is visible to everyone. Yes, that means anyone in the world can see those data points, so don't type in any personally identifiable information.</Text>
          <Text style={{ padding: 5 }}>Your ID is visible only to people who you allow.</Text>
          <Text style={{ padding: 5 }}>Your contact list is not saved to a server and not revealed to any other users (although they may check if they are visible to you).</Text>
          <Text style={{ padding: 5 }}>See the <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://endorser.ch/privacy-policy')}>Privacy Policy</Text> for more information.</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>How do I backup/export/import my identifier?</Text>
          <Text style={{ padding: 5 }}>On the Settings screen, scroll down and click 'Export Identifier', then show the "mnemonic phrase". Be careful to do this in a safe place! If you want to keep it secure then don't save it anywhere unencrypted... and if you don't already have a secure, encrypted location then it's not a bad idea to store it offline, meaning written down and locked away from everyone else.</Text>
          <Text style={{ padding: 5 }}>One more thing: your identifier has a specific "derivation path" listed in your settings, so copy that as well. (This is the default derivation path for this app, but if you use another app then you may have to give it to that app.)</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>Why do I see warnings about a missing backup?</Text>
          <Text style={{ padding: 5 }}>Some error has messed with your underlying seed phrase backup. Without a backup, this identifier is gone forever if you lose this device, and with it you lose the ability to verify yourself and your claims and your credentials. If you see that message and you haven't done a backup already, we beg of you: wipe your data now (after exporting your contacts) and create a new one that you can safely use to build reputation.</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>How do I change my mnemonic seed phrase password?</Text>
          <Text style={{ padding: 5 }}>First, export your phrase. Then go into Test Mode (under Settings and Advanced Mode) and click "Import ID" to import that phrase with the new password.</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>How do I backup/export/import my contacts?</Text>
          <Text style={{ padding: 5 }}>On the Contacts screen, click on "Copy All to Clipboard (CSV)" and send them to yourself (eg. by email).  You can then import them with the "Import Bulk (CSV)" on the same screen.</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>How do I delete a contact?</Text>
          <Text style={{ padding: 5 }}>Go to Test Mode (under Settings under Advanced Mode), and then you can delete any contact. But beware: there is currently no prompt for safety, so be careful... and after deleting, go back and exit Test Mode right away.</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>How do I generate a different identifier?</Text>
          <Text style={{ padding: 5 }}>One way is to go to Test Mode (under Settings under Advanced Mode), and then you can delete your current identifier and generate a new one.</Text>
          <Text style={{ padding: 5 }}>Here's another way, but note that this will erase the identifier and contacts, so we recommend you backup those first by following the instructions above.</Text>
          <Text style={{ padding: 5 }}>- On Android, you can go to the Storage in App Info and clear it. Remember to export your data first!</Text>
          <Text style={{ padding: 5 }}>- On iOS, the easiest way is to uninstall and reinstall the app. Remember to export your data first!</Text>
          <Text style={{ padding: 5 }}>(I know you expect better functionality and it's on the radar.)</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>Who do I call out for this?</Text>
          <Text style={{ padding: 5 }}>Trent, via:</Text>
          <Text style={{ padding: 5 }} selectable={true}>CommunityEndorser@gmail.com</Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>Who else do we have to thank?</Text>
          <Text style={{ padding: 5 }}>
            Specs like&nbsp;
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://www.w3.org/TR/vc-data-model/')}>
              Verifiable Credentials
            </Text>
            &nbsp;supported by&nbsp;
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://www.w3.org/')}>
              W3C
            </Text>
            &nbsp;and&nbsp;
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://trustoverip.org/')}>
              the Apache Trust over IP Foundation
            </Text>
            &nbsp;and&nbsp;
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://sovrin.org/')}>
              Sovrin
            </Text>
            &nbsp;and initiated by&nbsp;
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://internetidentityworkshop.com/')}>
              IIW
            </Text>
          </Text>
          <Text style={{ padding: 5 }}>
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://veramo.io')}>
              Veramo
            </Text>
            &nbsp;and its predecessor&nbsp;
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://uport.me')}>
              uPort
            </Text>
          </Text>
          <Text style={{ padding: 5 }}>
            <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://reactnative.dev/')}>
              React-Native
            </Text>
            &nbsp;and Android and iOS
          </Text>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>What info should I provide in feedback?</Text>
          <Text style={{ padding: 5 }} selectable={true}>
            Version { pkg.version } ({ VersionNumber.buildVersion })
            { logMessageSelector }
          </Text>
        </View>

        { Platform.OS === 'android'
          ?
            <View style={{ padding: 20 }}>
              <Text style={{ fontWeight: 'bold' }}>Should I upgrade?</Text>
              <Text style={{ padding: 5 }}>Check <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=ch.endorser.mobile')}>here in the Play Store</Text>.</Text>
            </View>
          : Platform.OS === 'ios'
            ?
              <View style={{ padding: 20 }}>
               <Text style={{ fontWeight: 'bold' }}>Should I to upgrade?</Text>
               <Text style={{ padding: 5 }}>Check <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://apps.apple.com/us/app/endorser-mobile/id1556368693')}>here in the App Store</Text>.</Text>
              </View>
            :
              <Text/>
        }

      </ScrollView>
    </SafeAreaView>
  )
}
