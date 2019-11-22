import { Contract } from "wavelet-client";
import JSBI from "jsbi";

class WaveletContract {
  constructor(wavelet, wallet, address, store) {
    this.wavelet = wavelet;
    this.wallet = wallet;
    this.address = address;
    this.contractName = address;
    this.store = store;
    this.methods = {};
    this.contract = new Contract(wavelet, address);
  }

  parseRequirements(schema, reqType) {
    return schema[reqType].required.map(key => {
      const { $ref, type } = schema[reqType].properties[key];

      let inputs = [];
      let outputs = [];

      if (reqType !== "constants") {
        const ref = $ref.replace("#/definitions/", "");
        const { properties } = schema.methods.definitions[ref];

        inputs = Object.keys(properties || {}).reduce((acc, argKey) => {
          const { type } = properties[argKey];
          acc.push({
            internalType: type,
            name: argKey,
            type
          });
          return acc;
        }, []);
      } else {
        outputs.push({
          internalType: type,
          name: "",
          type
        });
      }

      return {
        constant: key.includes("get_") ? true : false,
        inputs,
        name: key,
        outputs,
        payable: true,
        stateMutability: "nonpayable",
        type: "function"
      };
    });
  }
  async init() {
    await this.contract.init();

    const schema = this.getSchema();

    // this.methods = new Proxy({}, handler);
    this.abi = [
      ...this.parseRequirements(schema, "methods")
      // ...this.parseRequirements(schema, "constants")
    ];

    const call = method => () => {
      const fn = () => {
        const result = this.contract.test(this.wallet, method, JSBI.BigInt(0));

        return Promise.resolve(result.logs[0]);
      };
      return { call: fn };
    };

    const send = method => () => {
      const fn = (...args) => {
        const payload = this.abi
          .find(item => item.name === method)
          .inputs.reduce((acc, input, index) => {
            acc[input.name] = args[index];
            return acc;
          }, {});

        return this.contract.call(
          this.wallet,
          method,
          JSBI.BigInt(0),
          JSBI.BigInt(100000),
          JSBI.BigInt(0),
          {
            type: "string",
            value: JSON.stringify(payload)
          }
        );
      };
      return { send: fn };
    };

    for (var i = 0; i < this.abi.length; i++) {
      var item = this.abi[i];

      if (item.type == "function" && item.constant === true) {
        this.methods[item.name] = this.methods[item.name] || call(item.name);
        this.methods[item.name].cacheCall = this.cacheCallFunction(
          item.name,
          i
        );
      }

      if (item.type == "function" && item.constant === false) {
        this.methods[item.name] = this.methods[item.name] || send(item.name);
        this.methods[item.name].cacheSend = this.cacheSendFunction(
          item.name,
          i
        );
      }
    }
  }

  getSchema() {
    const result = this.contract.test(
      this.wallet,
      "get_schema",
      JSBI.BigInt(0)
    );
    return {
      constants: JSON.parse(result.logs[0]),
      methods: JSON.parse(result.logs[1])
    };
  }
  cacheCallFunction(fnName, fnIndex, fn) {
    var contract = this;

    return function() {
      // Collect args and hash to use as key, 0x0 if no args
      var argsHash = "0x0";
      var args = arguments;

      if (args.length > 0) {
        argsHash = contract.generateArgsHash(args);
      }
      const contractName = contract.contractName;
      const functionState = contract.store.getState().contracts[contractName][
        fnName
      ];

      // If call result is in state and fresh, return value instead of calling
      if (argsHash in functionState) {
        if (contract.store.getState().contracts[contractName].synced === true) {
          return argsHash;
        }
      }

      // Otherwise, call function and update store
      contract.store.dispatch({
        type: "CALL_CONTRACT_FN",
        contract,
        fnName,
        fnIndex,
        args,
        argsHash
      });

      // Return nothing because state is currently empty.
      return argsHash;
    };
  }

  cacheSendFunction(fnName, fnIndex, fn) {
    // NOTE: May not need fn index
    var contract = this;

    return function() {
      var args = arguments;

      const transactionStack = contract.store.getState().transactionStack;
      const stackId = transactionStack.length;
      const stackTempKey = `TEMP_${new Date().getTime()}`;

      // Add ID to "transactionStack" with temp value, will be overwritten on TX_BROADCASTED
      contract.store.dispatch({ type: "PUSH_TO_TXSTACK", stackTempKey });

      // Dispatch tx to saga
      // When txhash received, will be value of stack ID
      contract.store.dispatch({
        type: "SEND_CONTRACT_TX",
        contract,
        fnName,
        fnIndex,
        args,
        stackId,
        stackTempKey
      });

      // return stack ID
      return stackId;
    };
  }

  generateArgsHash(args) {
    var web3 = this.web3;
    var hashString = "";

    for (var i = 0; i < args.length; i++) {
      if (typeof args[i] !== "function") {
        var argToHash = args[i];

        // Stringify objects to allow hashing
        if (typeof argToHash === "object") {
          argToHash = JSON.stringify(argToHash);
        }

        // Convert number to strong to allow hashing
        if (typeof argToHash === "number") {
          argToHash = argToHash.toString();
        }

        // This check is in place for web3 v0.x
        if ("utils" in web3) {
          var hashPiece = web3.utils.sha3(argToHash);
        } else {
          var hashPiece = web3.sha3(argToHash);
        }

        hashString += hashPiece;
      }
    }

    return web3.utils.sha3(hashString);
  }
}

export default WaveletContract;
