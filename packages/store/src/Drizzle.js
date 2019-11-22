import { generateStore } from './generateStore'
import defaultOptions from './defaultOptions'
import merge from './mergeOptions'
import DrizzleContract from './DrizzleContract'
import WaveletContract from './WaveletContract'
import { Wavelet } from 'wavelet-client'



// Load as promise so that async Drizzle initialization can still resolve
var isEnvReadyPromise = new Promise((resolve, reject) => {
  const hasNavigator = typeof navigator !== 'undefined'
  const hasWindow = typeof window !== 'undefined'
  const hasDocument = typeof document !== 'undefined'

  if (hasNavigator && navigator.product === 'ReactNative') {
    return resolve()
  }

  if (hasWindow) {
    return window.addEventListener('load', resolve)
  }

  // resolve in any case if we missed the load event and the document is already loaded
  if (hasDocument && document.readyState === `complete`) {
    return resolve()
  }
})

export const getOrCreateWeb3Contract = (store, contractConfig, web3) => {
  if (contractConfig.web3Contract) {
    return contractConfig.web3Contract
  }

  const state = store.getState()
  const networkId = state.web3 && state.web3.networkId
  const selectedAccount = state.accounts[0]

  const { abi, networks, deployedBytecode } = contractConfig
  return (
    new web3.eth.Contract(abi, networks[networkId].address, {
      from: selectedAccount,
      data: deployedBytecode
    })
  )
}

class Drizzle {
    constructor(givenOptions, store) {
        const options = merge(defaultOptions, givenOptions);
        // Variables
        this.contracts = {};
        this.contractList = [];
        this.options = options;
        this.store = store || this.generateStore(options);
        this.web3 = {};

        this.wallet = Wavelet.loadWalletFromPrivateKey(options.wavelet.privateKey);
        this.wavelet = {};

        this.loadingContract = {};

        // Wait for window load event in case of injected web3.
        isEnvReadyPromise.then(() => {
            // Begin Drizzle initialization.
            this.store.dispatch({
                type: "DRIZZLE_INITIALIZING",
                drizzle: this,
                options
            });
        });
    }

    async addContract(contractAddress, events = []) {
        if (this.contracts[contractAddress]) {
            throw new Error(`Contract already exists: ${contractAddress}`);
        }

        const waveletContract = new WaveletContract(
            this.wavelet,
            this.wallet,
            contractAddress,
            this.store
        );

        await waveletContract.init();

        // const web3Contract = getOrCreateWeb3Contract(
        //   this.store,
        //   contractConfig,
        //   this.web3
        // )
        // const drizzleContract = new DrizzleContract(
        //   web3Contract,
        //   this.web3,
        //   contractConfig.contractName,
        //   this.store,
        //   events
        // )

        this.store.dispatch({
            type: "CONSENSUS_LISTENING",
            contract: waveletContract
        });

        this.store.dispatch({
            type: "CONTRACT_INITIALIZING",
            contractConfig: waveletContract
        });

        this.contracts[contractAddress] = waveletContract;
        this.contractList.push(waveletContract);

        this.store.dispatch({
            type: "CONTRACT_INITIALIZED",
            name: contractAddress
        });

    }

  deleteContract (contractName) {
    // Deleting a contract means removing it from this instance's
    // `contractList`, `contracts`, and `loadingContract`

    if (!this.contracts[contractName]) {
      throw new Error(`Contract does not exist: ${contractName}`)
    }

    this.contractList = this.contractList.filter(
      contract => contract.contractName !== contractName
    )

    const { [contractName]: omittedContract, ...restContracts } = this.contracts
    this.contracts = restContracts

    const {
      [contractName]: omittedLoading,
      ...restLoadingContract
    } = this.loadingContract

    this.loadingContract = restLoadingContract

    this.store.dispatch({
      type: 'DELETE_CONTRACT',
      contractName
    })
  }

  findContractByAddress (address) {
    return this.contractList.find(contract => {
      return contract.address.toLowerCase() === address.toLowerCase()
    })
  }

  /*
   * NOTE
   * This strangeness is for backward compatibility with < v1.2.4
   * Future versions will have generateStore's contents here
   */
  generateStore (options) {
    return generateStore(options)
  }
}

export default Drizzle
