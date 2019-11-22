import { call, put } from 'redux-saga/effects'
import * as Action from './constants'
import { Wavelet } from 'wavelet-client'



/*
 * Initialization
 */

export function * initializeWavelet (options) {
  try {
    let client = new Wavelet(options.host);
    
    yield put({ type: Action.WAVELET_INITIALIZED })
    return client;

  } catch (error) {
    yield put({ type: Action.WAVELET_FAILED, error })
    console.error('Error intializing Wavelet:')
    console.error(error)
  }
}

// /*
//  * Network ID
//  */

// export function * getNetworkId ({ web3 }) {
//   try {
//     const networkId = yield call(web3.eth.net.getId)

//     yield put({ type: Action.NETWORK_ID_FETCHED, networkId })

//     return networkId
//   } catch (error) {
//     yield put({ type: Action.NETWORK_ID_FAILED, error })

//     console.error('Error fetching network ID:')
//     console.error(error)
//   }
// }
