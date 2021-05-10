import React, { useState } from 'react'
import { ActivityIndicator, Button, Dimensions, FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import * as utility from '../utility/utility'
import { appStore } from '../veramo/appSlice'
import { agent } from '../veramo/setup'

export function MyCredentialsScreen({ navigation }) {

  const [identifiers, setIdentifiers] = useState<Identifier[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchResults, setSearchResults] = useState()

  const searchEndorser = async () => {
    setLoading(true)
    const endorserApiServer = appStore.getState().apiServer
    const token = await utility.accessToken(identifiers[0])
    const searchParam = searchTerm ? '&claimContents=' + encodeURIComponent(searchTerm) : ''
    fetch(endorserApiServer + '/api/claim?subject=' + identifiers[0].did + searchParam, {
      method: 'GET',
      headers: {
        "Content-Type": "application/json",
        "Uport-Push-Token": token,
      }
    }).then(response => {
      setLoading(false)
      if (response.status !== 200) {
        throw Error('There was an error from the server.')
      }
      return response.json()
    }).then(result => {
      setSearchResults(result)
    })
  }

  const isUser = (did) => did === identifiers[0].did

  useFocusEffect(
    React.useCallback(() => {
      agent.didManagerFind().then(ids => setIdentifiers(ids))
    }, [])
  )

  // Hack because without this it doesn't scroll to the bottom: https://stackoverflow.com/a/67244863/845494
  const screenHeight = Dimensions.get('window').height - 200

  return (
    <SafeAreaView>
      <View style={{ padding: 20, height: screenHeight }}>
        <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Search</Text>
        <Text>Filter (optional)</Text>
        <TextInput
          autoCapitalize={'none'}
          value={searchTerm}
          onChangeText={setSearchTerm}
          editable
          style={{ borderWidth: 1 }}
        />
        {
          loading
          ?
            <ActivityIndicator color="#00FF00" />
          :
            <View>
              <Button
                title="Search"
                onPress={searchEndorser}
              />
              <FlatList
                data={searchResults}
                keyExtractor={item => item.id.toString()}
                ItemSeparatorComponent={() => <View style={styles.line} />}
                ListEmptyComponent={
                  <Text>None</Text>
                }
                ListHeaderComponent={
                  <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>Matching Claims</Text>
                }
                renderItem={data =>
                  <Pressable onPress={ () =>
                    isUser(data.item.issuer)
                    ? navigation.navigate('Present Credential', { fullClaim: data.item })
                    : null
                  }>
                    <Text style={{ color: (isUser(data.item.issuer) ? "#0000FF" : "default") }}>{
                      utility.claimDescription(
                        data.item,
                        identifiers,
                        appStore.getState().contacts || [],
                        isUser(data.item.issuer) ? '' : ' (issued by a someone else)'
                      )
                    }</Text>
                  </Pressable>
                }
              />
            </View>
        }
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  line: {
    height: 0.8,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.9)"
  },
})