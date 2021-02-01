// Core interfaces
import { createAgent, IDIDManager, IResolver, IDataStore, IKeyManager } from '@veramo/core'

// Core identity manager plugin
import { DIDManager } from '@veramo/did-manager'

// Ethr did identity provider
import { EthrDIDProvider } from '@veramo/did-provider-ethr'

// Core key manager plugin
import { KeyManager } from '@veramo/key-manager'

// Custom key management system for RN
import { KeyManagementSystem } from '@veramo/kms-local-react-native'

// Custom resolver
// Custom resolvers
import { DIDResolverPlugin } from '@veramo/did-resolver'
import { Resolver } from 'did-resolver'
import { getResolver as ethrDidResolver } from 'ethr-did-resolver'
import { getResolver as webDidResolver } from 'web-did-resolver'

// Storage plugin using TypeOrm
import { Entities, KeyStore, DIDStore, IDataStoreORM } from '@veramo/data-store'

// TypeORM is installed with @veramo/typeorm
import { createConnection } from 'typeorm'

import { Contact } from '../entity/contact'
import { Settings } from '../entity/settings'


// You will need to get a project ID from infura https://www.infura.io
const INFURA_PROJECT_ID = '0f439b3b9237480ea8eb9da7b1f3965a'


const ALL_ENTITIES = Entities.concat([Contact, Settings])


// Create react native db connection
export const dbConnection = createConnection({
  type: 'react-native',
  database: 'veramo.sqlite',
  location: 'default',
  synchronize: true,
  logging: ['error', 'info', 'warn'],
  entities: ALL_ENTITIES,
})


function didProvider(netName) {
  return 'did:ethr' + (netName === 'mainnet' ? '' : ':' + netName)
}

const NETWORK_NAMES = ['mainnet', 'rinkeby']

const providers = {}
NETWORK_NAMES.forEach((networkName) => {
  providers[didProvider(networkName)] = new EthrDIDProvider({
    defaultKms: 'local',
    network: networkName,
    rpcUrl: 'https://' + networkName + '.infura.io/v3/' + INFURA_PROJECT_ID,
    gas: 1000001,
    ttl: 60 * 60 * 24 * 30 * 12 + 1,
  })
})

const didManager = new DIDManager({
  store: new DIDStore(dbConnection),
  defaultProvider: didProvider(NETWORK_NAMES[0]),
  providers: providers,
})

let didResolvers = NETWORK_NAMES.map((networkName) => {
  return new DIDResolverPlugin({
    resolver: new Resolver({
      ethr: ethrDidResolver({
        networks: [{ name: networkName, rpcUrl: 'https://' + networkName + '.infura.io/v3/' + INFURA_PROJECT_ID }],
      }).ethr,
      web: webDidResolver().web,
    }),
  })
})

let allPlugins = [
  new KeyManager({
    store: new KeyStore(dbConnection),
    kms: {
      local: new KeyManagementSystem(),
    },
  }),
  didManager,
].concat(didResolvers)

export const agent = createAgent<IDIDManager & IKeyManager & IDataStore & IDataStoreORM & IResolver>({ plugins: allPlugins })
