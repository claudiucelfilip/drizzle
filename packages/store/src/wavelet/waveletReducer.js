import * as Action from './constants'

const initialState = {
  status: ''
}

const waveletReducer = (state = initialState, action) => {
  if (action.type === Action.WAVELET_INITIALIZING) {
    return {
      ...state,
      status: 'initializing'
    }
  }

  if (action.type === Action.WAVELET_INITIALIZED) {
    return {
      ...state,
      status: 'initialized'
    }
  }

  if (action.type === Action.WAVELET_FAILED) {
    return {
      ...state,
      status: 'failed'
    }
  }

  if (action.type === Action.WAVELET_USER_DENIED) {
    return {
      ...state,
      status: 'UserDeniedAccess'
    }
  }


  return state
}

export default waveletReducer
