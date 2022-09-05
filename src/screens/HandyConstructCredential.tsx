import crypto from 'crypto'
import Debug from 'debug'
import * as didJwt from 'did-jwt'
import { DateTime, Duration } from 'luxon'
import * as R from 'ramda'
import React, { useEffect, useState } from 'react'
import { Alert, Button, FlatList, Linking, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableHighlight, TouchableOpacity, View } from 'react-native'
import { CheckBox } from "react-native-elements"
import RadioGroup, {RadioButtonProps} from 'react-native-radio-buttons-group'
import { useSelector } from 'react-redux'

import { ContactSelectModal } from './ContactSelect'
import { styles } from './style'
import { onboarding } from '../data/onboarding'
import { MASTER_COLUMN_VALUE, Settings } from '../entity/settings'
import * as utility from '../utility/utility'
import { BVCButton } from '../utility/utility.tsx'
import { appSlice, appStore } from '../veramo/appSlice'
import { agent, dbConnection } from '../veramo/setup'

const debug = Debug('endorser-mobile:share-credential')

const INITIAL_UNIT_BUTTONS: RadioButtonProps[] = [{
  id: '1', // acts as primary key, should be unique and non-empty string
  label: 'hours',
  selected: true,
  value: 'HUR',
}, {
  id: '2',
  label: 'bitcoin',
  value: 'BTC',
}, {
  id: '3',
  label: 'dollars',
  value: 'USD',
}, {
  id: '4',
  label: 'other',
  value: '',
}]
const INITIAL_SELECTED_BUTTON = R.find(R.prop('selected'), INITIAL_UNIT_BUTTONS)

export function HandyConstructCredentialScreen({ navigation }) {

  const [askForGaveInfo, setAskForGaveInfo] = useState<boolean>(false)
  const [askForOfferInfo, setAskForOfferInfo] = useState<boolean>(false)
  const [askForPersonInfo, setAskForPersonInfo] = useState<boolean>(false)
  const [askForPlanInfo, setAskForPlanInfo] = useState<boolean>(false)
  const [askForPledgeAbout, setAskForPledgeAbout] = useState<string>('')
  const [askForPledgeInfo, setAskForPledgeInfo] = useState<string>('')
  const [askForWitnessInfo, setAskForWitnessInfo] = useState<string>('')
  const [hasMnemonic, setHasMnemonic] = useState<boolean>(false)

  const identifiers = useSelector((state) => state.identifiers)
  const settings = useSelector((state) => state.settings)

  // Check for existing identifers on load and set them to state
  useEffect(() => {
    const getSettings = async () => {
      if (settings && (settings.mnemEncrBase64 || settings.mnemonic)) {
        setHasMnemonic(true)
      }
    }
    getSettings()
  }, [])

  return (
    <SafeAreaView>
      <ScrollView>
        <View style={{ padding: 20 }}>
          { identifiers && identifiers[0] ? (
            <View>
              <Text style={{ fontSize: 30, fontWeight: 'bold' }}>Select Contract or Pledge</Text>
              { !hasMnemonic ? (
                <Text style={{ padding: 10, color: 'red' }}>There is no backup available for this ID. We recommend you generate a different identifier and do not keep using this one. (See Help.)</Text>
              ) : (
                 <Text/>
              )}
              <View style={{ padding: 10 }}>
                {
                  askForGaveInfo
                  ? <GaveModal
                      cancel={ () => setAskForGaveInfo(false) }
                      proceed={ claim => {
                        setAskForGaveInfo(false)
                        navigation.navigate('Review & Sign', { credentialSubject: claim })
                      }}
                      userId={ identifiers[0].did }
                    />
                  : <View/>
                }
                {
                  askForPledgeInfo
                  ? <PledgeModal
                      about={ askForPledgeAbout }
                      agent={ identifiers[0].did }
                      pledge={ askForPledgeInfo }
                      cancel={ () => { setAskForPledgeAbout(''); setAskForPledgeInfo(''); } }
                      proceed={ claim => {
                        setAskForPledgeAbout('')
                        setAskForPledgeInfo('')
                        navigation.navigate('Review & Sign', { credentialSubject: claim })
                      }}
                    />
                  : <View/>
                }
                <View>

                  <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '30%' }}/>
                  <Text>Contracts</Text>

                  <Button
                    title={'Contract'}
                    onPress={() => setAskForGaveInfo(true)}
                  />

                  <Button
                    title={'Contract2'}
                    onPress={() => navigation.navigate('Contract Form', { onboardingChoice: onboarding.c30_mca })}
                  />

                  <View style={{ padding: 5 }} />
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '30%' }}/>
                  <Text>Pledges</Text>

                  <Button
                    title={'Pledge To Mutual Integrity'}
                    onPress={() => {
                      setAskForPledgeAbout("Copyright 2021 Mutual Integrity Foundation")
                      setAskForPledgeInfo("I pledge to honor my word as my bond and support others as peers in acting with integrity. I accept that dishonoring my word and this pledge will result in a breach of integrity as recorded on my reputation slate until I measure the impact and make amends.")
                    }}
                  />

                  {/**
                  <View style={{ padding: 5 }} />
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.9)', height: 0.8, width: '30%' }}/>
                  <Text>Other</Text>
                  <Button
                    title={'Scan For Claim'}
                    onPress={() =>
                      navigation.navigate(
                        'Scan Content',
                        {
                          nextData: { substitute: true },
                          nextScreen: 'Review & Sign',
                          title: 'Scan Claim Template',
                        }
                      )
                    }
                  />
                  **/}

                </View>
              </View>
            </View>
          ) : (
            <Text>You must create an identifier (under Settings).</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )

  /**
    props has:
    - proceed function that takes the claim
    - cancel function
   **/
  function PlanModal(props) {

    const [agentId, setAgentId] = useState<string>(props.userId)
    const [endTime, setEndTime] = useState<string>(null)
    const [planDescription, setPlanDescription] = useState<string>(null)
    const [planIdentifier, setPlanIdentifier] = useState<string>(null)
    const [resultDescription, setResultDescription] = useState<string>(null)
    const [resultIdentifier, setResultIdentifier] = useState<string>(null)
    const [selectAgentFromContacts, setSelectAgentFromContacts] = useState<boolean>(false)

    const allContacts = useSelector((state) => state.contacts || [])

    function possiblyFinish(proceedToFinish) {
      // yes, this may throw an error
      const isoEndTime = endTime && new Date(endTime).toISOString()

      if (!planDescription && !resultDescription) {
        Alert.alert('You must describe either the plan or the result.')
      } else {
        let result = {
          "@context": "https://schema.org",
          "@type": "PlanAction",
        }

        const planId = planIdentifier || crypto.randomBytes(16).toString('hex')

        result.agent = agentId ? { identifier: agentId } : undefined
        result.description = planDescription || undefined
        result.endTime = isoEndTime || undefined
        result.identifier = planId

        const resultId = resultIdentifier || crypto.randomBytes(16).toString('hex')

        result.result = {
          "@type": "CreativeWork",
          identifier: resultId,
          description: resultDescription || undefined
        }

        proceedToFinish(result)
      }
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>

              {
                selectAgentFromContacts
                ? <ContactSelectModal
                    cancel={ () => { setSelectAgentFromContacts(false) } }
                    proceed={ (did) => { setAgentId(did); setSelectAgentFromContacts(false) }}
                  />
                : <View/>
              }

              <View>
                <Text style={styles.modalText}>Plan</Text>

                <View style={{ padding: 5 }}>
                  <Text>Planner</Text>
                  <TextInput
                    value={agentId}
                    onChangeText={setAgentId}
                    editable
                    style={{ borderWidth: 1 }}
                    autoCapitalize={'none'}
                    autoCorrect={false}
                  />
                  {
                    allContacts.length > 0
                    ? <TouchableHighlight
                        style={styles.moreButton}
                        onPress={() => setSelectAgentFromContacts(true)}
                      >
                        <Text>Pick</Text>
                      </TouchableHighlight>
                    : <View />
                  }
                </View>

                <View style={{ padding: 5 }}>
                  <Text>Description of Plan</Text>
                  <TextInput
                    value={planDescription}
                    onChangeText={setPlanDescription}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 5 }}>
                  <Text>Target Date</Text>
                  <TextInput
                    value={endTime}
                    onChangeText={setEndTime}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 5 }}>
                  <Text>ID of Plan</Text>
                  <TextInput
                    value={planIdentifier}
                    onChangeText={setPlanIdentifier}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 10 }} />
                <Text style={styles.modalText}>Result</Text>

                <View style={{ padding: 5 }}>
                  <Text>Description of Result</Text>
                  <TextInput
                    value={resultDescription}
                    onChangeText={setResultDescription}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 5 }}>
                  <Text>ID of Result</Text>
                  <TextInput
                    value={resultIdentifier}
                    onChangeText={setResultIdentifier}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 10 }} />
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => possiblyFinish(props.proceed)}
                >
                  <Text>Finish...</Text>
                </TouchableHighlight>
                <View style={{ padding: 5 }} />
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={props.cancel}
                >
                  <Text>Cancel</Text>
                </TouchableHighlight>
              </View>
            </View>
          </View>
        </ScrollView>
      </Modal>
    )
  }

  /**
    props has:
    - proceed function that takes the claim
    - cancel function
   **/
  function GaveModal(props) {

    const [agentId, setAgentId] = useState<string>(props.userId)
    const [amountStr, setAmountStr] = useState<number>('')
    const [description, setDescription] = useState<string>(null)
    const [isSpecificAmount, setIsSpecificAmount] = useState<boolean>(false)
    const [objectGiven, setObjectGiven] = useState<string>(null)
    const [recipientId, setRecipientId] = useState<string>(null)
    const [selectAgentFromContacts, setSelectAgentFromContacts] = useState<boolean>(false)
    const [selectRecipientFromContacts, setSelectRecipientFromContacts] = useState<boolean>(false)
    const [unit, setUnit] = useState<string>(INITIAL_SELECTED_BUTTON && INITIAL_SELECTED_BUTTON.value)
    const [unitButtons, setUnitButtons] = useState<RadioButtonProps[]>(INITIAL_UNIT_BUTTONS)

    const allContacts = useSelector((state) => state.contacts || [])

    function toggleIsSpecificAmount() {
      setIsSpecificAmount(!isSpecificAmount)
    }

    function setUnitSelection(buttons) {
      setUnitButtons(buttons)
      const selectedButton = R.find(R.prop('selected'), buttons)
      setUnit(selectedButton.value)
    }

    function possiblyFinish(proceedToFinish) {
      if (!isSpecificAmount && !objectGiven) {
        Alert.alert('You must indicate the object given.')
      } else if (isSpecificAmount && (!amountStr || !unit)) {
        Alert.alert('You must give a specific amount and unit.')
      } else if (isSpecificAmount && isNaN(Number(amountStr))) {
        Alert.alert('You must give a valid numeric amount.')
      } else {
        let result = {
          "@context": "https://schema.org",
          "@type": "GiveAction",
        }

        result.object =
          !isSpecificAmount
          ? objectGiven
          : {
            // TypeAndQuantityNode

            amountOfThisGood: Number(amountStr),

            /**
              These units are typically in currency or time.

              Units for currencies are described in multiple places at schema.org:
              https://schema.org/currency
              https://schema.org/priceCurrency
              https://schema.org/price

              We've chosen "HUR" from UN/CEFACT for time in hours.
              (Many other units for time at schema.org are in ISO 8601 duration format.)
            **/
            unitCode: unit,
          }

        result.agent = agentId ? { identifier: agentId } : undefined
        result.recipient = recipientId ? { identifier: recipientId } : undefined
        result.description = description || undefined
        proceedToFinish(result)
      }
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>

              {
                selectAgentFromContacts
                ? <ContactSelectModal
                    cancel={ () => { setSelectAgentFromContacts(false) } }
                    proceed={ (did) => { setAgentId(did); setSelectAgentFromContacts(false) }}
                  />
                : <View/>
              }
              {
                selectRecipientFromContacts
                ? <ContactSelectModal
                    cancel={ () => { setSelectRecipientFromContacts(false) } }
                    proceed={ (did) => { setRecipientId(did); setSelectRecipientFromContacts(false) }}
                  />
                : <View/>
              }

              <View>
                <Text style={styles.modalText}>Gave</Text>

                <View style={{ padding: 5 }}>
                  <Text>Giver</Text>
                  <TextInput
                    value={agentId}
                    onChangeText={setAgentId}
                    editable
                    style={{ borderWidth: 1 }}
                    autoCapitalize={'none'}
                    autoCorrect={false}
                  />
                  {
                    allContacts.length > 0
                    ? <TouchableHighlight
                        style={styles.moreButton}
                        onPress={() => setSelectAgentFromContacts(true)}
                      >
                        <Text>Pick</Text>
                      </TouchableHighlight>
                    : <View />
                  }
                </View>

                <View style={{ padding: 5 }}>
                  <Text>Recipient</Text>
                  <TextInput
                    value={recipientId}
                    onChangeText={setRecipientId}
                    editable
                    style={{ borderWidth: 1 }}
                    autoCapitalize={'none'}
                    autoCorrect={false}
                  />
                  {
                    allContacts.length > 0
                    ? <TouchableHighlight
                        style={styles.moreButton}
                        onPress={() => setSelectRecipientFromContacts(true)}
                      >
                        <Text>Pick</Text>
                      </TouchableHighlight>
                    : <View />
                  }
                </View>

                {
                  !isSpecificAmount ? (
                    <View style={{ padding: 5 }}>
                      <Text>Object Given</Text>
                      <TextInput
                        value={objectGiven}
                        onChangeText={setObjectGiven}
                        editable
                        multiline={true}
                        style={{ borderWidth: 1 }}
                      />
                    </View>
                  ) : (
                    <View />
                  )
                }

                <CheckBox
                  title="I'll specify an amount."
                  checked={isSpecificAmount}
                  onPress={toggleIsSpecificAmount}
                />

                {
                  isSpecificAmount ? (
                    <View>
                      <View style={{ padding: 5 }}>
                        <Text>Amount</Text>
                        <TextInput
                          value={amountStr}
                          onChangeText={setAmountStr}
                          editable
                          style={{ borderWidth: 1 }}
                        />
                      </View>

                      <View style={{ padding: 5 }}>
                        <Text>Unit</Text>
                        <TextInput
                          value={unit}
                          onChangeText={setUnit}
                          editable
                          style={{ borderWidth: 1 }}
                          width={ 50 }
                        />
                        {
                          (R.find(R.prop('selected'), unitButtons).value == '') ? (
                            <Text>
                              You can see the <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://www.xe.com/iso4217.php')}>codes for currencies here</Text> and the <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('http://wiki.goodrelations-vocabulary.org/Documentation/UN/CEFACT_Common_Codes')}>codes for other units here</Text>.
                            </Text>
                          ) : (
                            <View/>
                          )
                        }
                        <RadioGroup
                          layout='row'
                          radioButtons={unitButtons}
                          onPress={setUnitSelection}
                        />
                      </View>

                    </View>
                  ) : (
                    <View />
                  )
                }

                <View style={{ padding: 5 }}>
                  <Text>Comment</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 10 }} />
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => possiblyFinish(props.proceed)}
                >
                  <Text>Finish...</Text>
                </TouchableHighlight>
                <View style={{ padding: 5 }} />
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={props.cancel}
                >
                  <Text>Cancel</Text>
                </TouchableHighlight>
              </View>
            </View>
          </View>
        </ScrollView>
      </Modal>
    )
  }

  /**
    props has:
    - userId for the current user's ID
    - proceed function that takes the claim
    - cancel function
   **/
  function OfferModal(props) {

    const [agentId, setAgentId] = useState<string>(props.userId)
    const [amountStr, setAmountStr] = useState<number>('')
    const [description, setDescription] = useState<string>(null)
    const [isSpecificAmount, setIsSpecificAmount] = useState<boolean>(false)
    const [multipleTransfersAllowed, setMultipleTransfersAllowed] = useState<boolean>(false)
    const [recipientId, setRecipientId] = useState<string>(null)
    const [selectAgentFromContacts, setSelectAgentFromContacts] = useState<boolean>(false)
    const [selectRecipientFromContacts, setSelectRecipientFromContacts] = useState<boolean>(false)
    const [termsOfService, setTermsOfService] = useState<string>('')
    const [transferAllowed, setTransferAllowed] = useState<boolean>(false)
    const [unit, setUnit] = useState<string>(INITIAL_SELECTED_BUTTON && INITIAL_SELECTED_BUTTON.value)
    const [unitButtons, setUnitButtons] = useState<RadioButtonProps[]>(INITIAL_UNIT_BUTTONS)
    const [validThrough, setValidThrough] = useState<string>(DateTime.local().plus(Duration.fromISO("P6M")).toISODate())

    const allContacts = useSelector((state) => state.contacts || [])

    function toggleIsSpecificAmount() {
      setIsSpecificAmount(!isSpecificAmount)
    }

    function setUnitSelection(buttons) {
      setUnitButtons(buttons)
      const selectedButton = R.find(R.prop('selected'), buttons)
      setUnit(selectedButton.value)
    }

    function possiblyFinish(proceedToFinish) {

      // An embedded item is useful for later reference (via identifier).
      // Other apps may choose to use price & priceCurrency.
      if (!isSpecificAmount && !description) {
        Alert.alert('You must describe the offering or give a specific amount.')
      } else if (isSpecificAmount && (!amountStr || !unit)) {
        Alert.alert('You must give a specific amount and unit.')
      } else if (isSpecificAmount && isNaN(Number(amountStr))) {
        Alert.alert('You must give a valid numeric amount.')
      } else {
        let result = {
          "@context": "https://schema.org",
          "@type": "Offer",
          identifier: crypto.randomBytes(16).toString('hex'),
          numberOfTransfersAllowed: multipleTransfersAllowed ? Number.MAX_SAFE_INTEGER : (transferAllowed ? 1 : 0),
          offeredBy: { identifier: agentId },
        }

        result.description = description || undefined

        result.itemOffered =
          !isSpecificAmount
          ? undefined
          : {
            // TypeAndQuantityNode

            amountOfThisGood: Number(amountStr),

            /**
              These units are typically in currency or time.

              Units for currencies are described in multiple places at schema.org:
              https://schema.org/currency
              https://schema.org/priceCurrency
              https://schema.org/price

              We've chosen HUR from UN/CEFACT for the length of time.
              Alternatively, units for time at schema.org can be in ISO 8601 format.
            **/
            unitCode: unit,
          }

        result.recipient = recipientId ? { identifier: recipientId } : undefined

        result.termsOfService = termsOfService ? termsOfService : undefined

        result.validThrough = validThrough ? validThrough : undefined

        proceedToFinish(result)
      }
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>

              {
                selectAgentFromContacts
                ? <ContactSelectModal
                    cancel={ () => { setSelectAgentFromContacts(false) } }
                    proceed={ (did) => { setAgentId(did); setSelectAgentFromContacts(false) }}
                  />
                : <View/>
              }
              {
                selectRecipientFromContacts
                ? <ContactSelectModal
                    cancel={ () => { setSelectRecipientFromContacts(false) } }
                    proceed={ (did) => { setRecipientId(did); setSelectRecipientFromContacts(false) }}
                  />
                : <View/>
              }

              <View>
                <Text style={styles.modalText}>Offer</Text>

                <View style={{ padding: 5 }}>
                  <Text>Agent</Text>
                  <TextInput
                    value={agentId}
                    onChangeText={setAgentId}
                    editable
                    style={{ borderWidth: 1 }}
                    autoCapitalize={'none'}
                    autoCorrect={false}
                  />
                  {
                    agentId != props.userId
                    ? <Text style={{ color: 'red' }}>It is very strange to put someone else as the Agent making this offer.</Text>
                    : <View />
                  }
                  {
                    allContacts.length > 0
                    ? <TouchableHighlight
                        style={styles.moreButton}
                        onPress={() => setSelectAgentFromContacts(true)}
                      >
                        <Text>Pick</Text>
                      </TouchableHighlight>
                    : <View />
                  }
                </View>

                <View style={{ padding: 5 }}>
                  <Text>Recipient</Text>
                  <TextInput
                    value={recipientId}
                    onChangeText={setRecipientId}
                    editable
                    style={{ borderWidth: 1 }}
                    autoCapitalize={'none'}
                    autoCorrect={false}
                  />
                  {
                    allContacts.length > 0
                    ? <TouchableHighlight
                        style={styles.moreButton}
                        onPress={() => setSelectRecipientFromContacts(true)}
                      >
                        <Text>Pick</Text>
                      </TouchableHighlight>
                    : <View />
                  }
                </View>

                <View style={{ padding: 5 }}>
                  <Text>Description</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 5 }}>
                  <Text>Terms, Conditions, Limitations, etc</Text>
                  <TextInput
                    value={termsOfService}
                    onChangeText={setTermsOfService}
                    editable
                    multiline={true}
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <CheckBox
                  title='This is a specific amount.'
                  checked={isSpecificAmount}
                  onPress={toggleIsSpecificAmount}
                />

                {
                  isSpecificAmount ? (
                    <View>
                      <View style={{ padding: 5 }}>
                        <Text>Amount</Text>
                        <TextInput
                          value={amountStr}
                          onChangeText={setAmountStr}
                          editable
                          style={{ borderWidth: 1 }}
                        />
                      </View>

                      <View style={{ padding: 5 }}>
                        <Text>Unit</Text>
                        <TextInput
                          value={unit}
                          onChangeText={setUnit}
                          editable
                          style={{ borderWidth: 1 }}
                          width={ 50 }
                        />
                        {
                          (R.find(R.prop('selected'), unitButtons).value == '') ? (
                            <Text>
                              You can see the <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('https://www.xe.com/iso4217.php')}>codes for currencies here</Text> and the <Text style={{ color: 'blue' }} onPress={() => Linking.openURL('http://wiki.goodrelations-vocabulary.org/Documentation/UN/CEFACT_Common_Codes')}>codes for other units here</Text>.
                            </Text>
                          ) : (
                            <View/>
                          )
                        }
                        <RadioGroup
                          layout='row'
                          radioButtons={unitButtons}
                          onPress={setUnitSelection}
                        />
                      </View>

                    </View>
                  ) : (
                    <View/>
                  )
                }

                <View style={{ padding: 5 }}>
                  <Text>Valid Through</Text>
                  <TextInput
                    value={validThrough}
                    onChangeText={setValidThrough}
                    editable
                    style={{ borderWidth: 1 }}
                  />
                </View>

                <View style={{ padding: 5 }}>
                  <CheckBox
                    title='Transfer Allowed'
                    checked={transferAllowed}
                    onPress={() => {setTransferAllowed(!transferAllowed)}}
                  />
                  <View style={{ padding: 5, display: (transferAllowed ? 'flex' : 'none') }}>
                    <CheckBox
                      title='Multiple Transfers Allowed'
                      checked={multipleTransfersAllowed}
                      onPress={() => {setMultipleTransfersAllowed(!multipleTransfersAllowed)}}
                      visible={transferAllowed}
                    />
                  </View>
                </View>

                <View style={{ padding: 10 }} />
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => possiblyFinish(props.proceed)}
                >
                  <Text>Finish...</Text>
                </TouchableHighlight>
                <View style={{ padding: 5 }} />
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={props.cancel}
                >
                  <Text>Cancel</Text>
                </TouchableHighlight>
              </View>

            </View>
          </View>
        </ScrollView>
      </Modal>
    )
  }

  /**
    props has:
    - identifier string for the identifier of the provider
    - proceed function that takes the claim
    - cancel function... cancels
   **/
  function PersonModal(props) {

    const [knowsText, setKnowsText] = useState<string>('')
    const [located, setLocated] = useState<string>('')
    const [seeksText, setSeeksText] = useState<string>('')

    function constructPerson() {
      let result = {
        "@context": "https://schema.org",
        "@type": "Person",
        "identifier": props.identifier,
      }
      if (located) {
        result = R.mergeRight(result, { homeLocation: { address: located } })
      }
      if (knowsText) {
        result = R.mergeRight(result, { knowsAbout: knowsText })
      }
      if (seeksText) {
        result = R.mergeRight(result, { seeks: seeksText })
      }
      return result
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <View>

                <View>
                  <Text style={styles.modalText}>I Know About...</Text>
                  <TextInput
                    value={knowsText}
                    onChangeText={setKnowsText}
                    editable
                    style={{ borderWidth: 1 }}
                    multiline={true}
                    autoCapitalize={'none'}
                  />
                </View>

                <View style={{ padding: 20 }} />
                <View>
                  <Text style={styles.modalText}>I Am Looking For...</Text>
                  <TextInput
                    value={seeksText}
                    onChangeText={setSeeksText}
                    editable
                    style={{ borderWidth: 1 }}
                    multiline={true}
                    autoCapitalize={'none'}
                  />
                </View>

                <View style={{ padding: 20 }} />
                <View>
                  <Text style={styles.modalText}>I Am Located...</Text>
                  <TextInput
                    value={located}
                    onChangeText={setLocated}
                    editable
                    style={{ borderWidth: 1 }}
                    multiline={true}
                    autoCapitalize={'none'}
                  />
                </View>

                <View style={{ padding: 10 }} />
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => props.proceed(constructPerson())}
                >
                  <Text>Finish...</Text>
                </TouchableHighlight>
                <View style={{ padding: 5 }} />
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={props.cancel}
                >
                  <Text>Cancel</Text>
                </TouchableHighlight>

              </View>
            </View>
          </View>
        </ScrollView>
      </Modal>
    )
  }

  /**
    props has:
    - agent string for the identifier of the provider
    - pledge string for the promise being made
    - proceed function that takes the claim
    - cancel function
   **/
  function PledgeModal(props) {

    const about = props.about

    const [pledge, setPledge] = useState<string>(props.pledge)

    function constructPledge() {
      return {
        "@context": "https://schema.org",
        "@type": "AcceptAction",
        "agent": { identifier: props.agent },
        "object": pledge,
      }
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <View>
                <Text style={styles.modalText}>Accept</Text>

                <Text>{about}</Text>

                <View style={{ padding: 5 }}>
                  <TextInput
                    value={pledge}
                    onChangeText={setPledge}
                    editable
                    style={{ borderWidth: 1 }}
                    multiline={true}
                  />
                </View>

                <View style={{ padding: 10 }} />
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => props.proceed(constructPledge())}
                >
                  <Text>Finish...</Text>
                </TouchableHighlight>
                <View style={{ padding: 5 }} />
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={props.cancel}
                >
                  <Text>Cancel</Text>
                </TouchableHighlight>

              </View>
            </View>
          </View>
        </ScrollView>
      </Modal>
    )
  }

  /**
    props has:
    - text - string with the text of what was seen
    - proceed - function that takes the claim
    - cancel - function to cancel action
   **/
  function WitnessModal(props) {

    const [identifier, setIdentifier] = useState<string>('')
    const [selectFromContacts, setSelectFromContacts] = useState<boolean>(false)
    const [text, setText] = useState<string>(props.text)

    const allContacts = useSelector((state) => state.contacts || [])

    function constructWitness() {
      return {

        // We might prefer this but the URLs don't resolve.
        // https://lov.linkeddata.es/dataset/lov/terms?q=appreciate

        "@context": "http://purl.org/vocab/bio/0.1/",
        "@type": "Event",
        "agent": { identifier: identifier },
        "description": text,
      }
    }

    return (
      <Modal
        animationType="slide"
        transparent={true}
        onRequestClose={props.cancel}
      >
        <ScrollView>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              {
                selectFromContacts
                ? <ContactSelectModal
                    cancel={ () => { setSelectFromContacts(false) } }
                    proceed={ (did) => { setIdentifier(did); setSelectFromContacts(false) }}
                  />
                : <View/>
              }

              <View>
                <Text style={styles.modalText}>Witness</Text>

                <View style={{ padding: 5 }}>
                  <Text>Identifier</Text>
                  <TextInput
                    value={identifier}
                    onChangeText={setIdentifier}
                    editable
                    style={{ borderWidth: 1, width: 300 }}
                    autoCapitalize={'none'}
                    autoCorrect={false}
                  />
                  {
                    allContacts.length > 0
                    ? <TouchableHighlight
                        style={styles.moreButton}
                        onPress={() => setSelectFromContacts(true)}
                      >
                        <Text>Pick</Text>
                      </TouchableHighlight>
                    : <View />
                  }
                </View>

                <View style={{ marginTop: 20 }}>
                  <Text>What I Saw</Text>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    editable
                    style={{ borderWidth: 1 }}
                    multiline={true}
                  />
                  <Text>* Note that this description will be visible to the world, so beware not to include names, addresses, etc.</Text>
                </View>

                <View style={{ padding: 10 }} />
                <TouchableHighlight
                  style={styles.saveButton}
                  onPress={() => props.proceed(constructWitness())}
                >
                  <Text>Finish...</Text>
                </TouchableHighlight>
                <View style={{ padding: 5 }} />
                <TouchableHighlight
                  style={styles.cancelButton}
                  onPress={props.cancel}
                >
                  <Text>Cancel</Text>
                </TouchableHighlight>

              </View>
            </View>
          </View>
        </ScrollView>
      </Modal>
    )
  }

}
