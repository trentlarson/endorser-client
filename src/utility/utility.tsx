import { DateTime } from 'luxon'
import * as R from 'ramda'
import React, { useState } from 'react'
import { Button, Modal, Text, TouchableHighlight, View } from 'react-native'
import { useSelector } from 'react-redux'

import * as utility from './utility'
import { styles } from '../screens/style'

function setClaimToAttendance(id: IIdentifier | undefined, startTime: string, navigation) {
  const claimObj = utility.bvcClaim(id ? id.did : 'UNKNOWN', startTime)
  navigation.navigate('Sign Credential', { credentialSubject: claimObj })
}

export const BVCButton = ({ identifier, navigation, description }) => {

  const todayIsSaturday = DateTime.local().weekday === 6

  return (
    <Button
      title={'Attended ' + description + ' ' + (todayIsSaturday ? 'Today' : 'Last Time')}
      onPress={() => {
        let currentOrPreviousSat = DateTime.local()
        if (currentOrPreviousSat.weekday < 6) {
          // it's not Saturday or Sunday, so move back one week before setting to the Saturday
          currentOrPreviousSat = currentOrPreviousSat.minus({week:1})
        }
        const eventStartDateObj = currentOrPreviousSat.set({weekday:6}).set({hour:9}).startOf("hour")
        // Hack, but the full ISO pushes the length to 340 which crashes verifyJWT!  Crazy!
        const TODAY_OR_PREV_START_DATE = eventStartDateObj.toISO({suppressMilliseconds:true})
        setClaimToAttendance(identifier, TODAY_OR_PREV_START_DATE, navigation)
      }}
    />
  )
}

/**
 * Render each claim with links to take actions.
 *
 * obj is any object or array
 * claimId (optional) is the ID for server lookup
 */
export const YamlFormat = ({ source, claimId, navigation, onClickVisibleToDids }) => {

  const [didForVisibleModal, setDidForVisibleModal] = useState<string>(null)

  const identifiers = useSelector((state) => state.identifiers || [])
  const allContacts = useSelector((state) => state.contacts || [])

  /**
   * see objectToYamlReact for items that include actions
   */
  const objectToYamlReactRecur = (obj, claimId, visibleToDids, onClickVisibleToDids) => {
    if (obj instanceof Object) {
      if (Array.isArray(obj)) {
        // array: loop through elements
        return (
          <View style={{ padding: 1 }}>
            {
              obj.map((item, index) =>
                <View key={ index } style={{ marginLeft: 5 }}>
                  <Text>- </Text>{ objectToYamlReactRecur(item, claimId || item.id, null, onClickVisibleToDids) }
                </View>
              )
              /** This complained about being inside a ScrollView, and about nesting.
              <FlatList
                data={ obj }
                keyExtractor={(item, index) => "" + index}
                renderItem={(item, index) =>
                  <View style={{ marginLeft: 5 }}>
                    <Text>- </Text>{ objectToYamlReactRecur(item, claimId || item.id, null, onClickVisibleToDids) }
                  </View>
                }
              />
              **/
            }
          </View>
        )
      } else {
        // regular object: loop through keys
        return (
          <View style={{ padding: 1 }}>
            {
              R.keys(obj).map((key, index) => {
                const newline = obj[key] instanceof Object ? "\n" : ""
                return (
                  <Text key={ index } style={{ marginLeft: 20 }}>
                    { key } : { newline }{ objectToYamlReactRecur(obj[key], claimId, obj[key + 'VisibleToDids'], onClickVisibleToDids) }
                  </Text>
                )}
              )
            }
          </View>
        )
      }
    } else {
      const isVisibleDid = (typeof obj == 'string' && utility.isDid(obj) && !utility.isHiddenDid(obj))
      const style = (visibleToDids != null || isVisibleDid) ? { color: 'blue' } : {}
      const onPress =
        isVisibleDid
        ? () => { setDidForVisibleModal(obj) }
        : (visibleToDids != null)
          ? () => { onClickVisibleToDids(claimId, visibleToDids) }
          : () => {}
      return (
        <Text
          style={ style }
          onPress={ onPress }
        >
          { JSON.stringify(obj) }
        </Text>
      )
    }
  }

  return (
    <View>
      {
        source.map((item, index) =>
          <View key={ index } style={{ marginLeft: 5 }}>
            {
              item.claimType === 'DonateAction'
              ?
                <Text
                  style={{ color: 'blue' }}
                  onPress={() => navigation.navigate(
                    'Sign Credential',
                    { credentialSubject:
                      { '@context': 'http://schema.org',
                        '@type': 'GiveAction',
                        agent: item.claim.agent,
                        recipient: item.claim.recipient,
                        identifier: item.claim.identifier,
                        price: item.claim.price,
                        priceCurrency: item.claim.priceCurrency,
                      }
                    }
                  )}
                >
                  Record as Paid
                </Text>
              :
                <View />
            }
            {
              item.claimType !== 'AgreeAction'
              ?
                <Text
                  style={{ color: 'blue' }}
                  onPress={() => navigation.navigate(
                    'Sign Credential',
                    { credentialSubject:
                      { '@context': 'http://schema.org',
                        '@type': 'AgreeAction',
                        object: item.claim,
                      }
                    }
                  )}
                >
                  Agree
                </Text>
              :
                <View />
            }
            <Text>- </Text>{ objectToYamlReactRecur(item, claimId || item.id, null, onClickVisibleToDids) }
          </View>
        )
      }

      <Modal
        animationType="slide"
        transparent={true}
        visible={!!didForVisibleModal}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text>
              { utility.didInContext(didForVisibleModal, identifiers, allContacts) }
            </Text>
            <TouchableHighlight
              style={styles.cancelButton}
              onPress={() => {
                setDidForVisibleModal(null)
              }}
            >
              <Text>Close</Text>
            </TouchableHighlight>
          </View>
        </View>
      </Modal>

    </View>
  )
}
