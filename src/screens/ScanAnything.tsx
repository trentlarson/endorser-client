import React from 'react'
import { Button, SafeAreaView, ScrollView, Text, View } from 'react-native'
import QRCodeScanner from 'react-native-qrcode-scanner'

import { appStore } from '../veramo/appSlice'
import * as utility from '../utility/utility'

const SAMPLE_CREDENTIAL_TEMPLATE = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  'name': 'Galactic Empire',
  'member': {
    '@type': 'OrganizationRole',
    'roleName': 'Darth Vader',
    'member': {
      '@type': 'Person',
      'identifier': utility.REPLACE_USER_DID_STRING
    }
  }
}
const SAMPLE_CREDENTIAL_TEMPLATE_STRING = JSON.stringify(SAMPLE_CREDENTIAL_TEMPLATE)




export function ScanAnythingScreen({ navigation, route }) {

  const nextData = route.params.nextData || {}
  const nextScreen = route.params.nextScreen
  const title = route.params.title

  const onSuccessfulQrEvent = async (e) => {
    nextData.scanned = e.data
    navigation.navigate(nextScreen, nextData)
  }

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: 'bold' }}>{ title }</Text>

          <View>
            <QRCodeScanner onRead={onSuccessfulQrEvent} />
            { appStore.getState().testMode
              ?
                <View>
                  <Button
                    title={ 'Send fake stuff to ' + nextScreen + ' screen'}
                    onPress={() => {
                      nextData.scanned = '"Some sample data for you. Yum!"'
                      return navigation.navigate(nextScreen, nextData)
                    }}
                  />
                  <Button
                    title={ 'Send fake credential template to ' + nextScreen + ' screen'}
                    onPress={() => {
                      nextData.scanned = SAMPLE_CREDENTIAL_TEMPLATE_STRING
                      return navigation.navigate(nextScreen, nextData)
                    }}
                  />
                </View>
              :
                <View />
            }
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
