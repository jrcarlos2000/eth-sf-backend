# JomTx - Backend
JomTx backend handles proof generation and data retrieval for JomTx protocol. It provides an API that allows non-crypto users to generate receipts while storing data on a decentralized graph-node.

[click to seee the contract repo]('https://github.com/jrcarlos2000/eth-sf-contracts')

## API - POST
**`/verify-worldcoin-dev`**

Mints a fake identity as if using the worldcoin identity faucet

```javascript
    params : 
    {
    "storeKey" : "store1",
    "chainId"  : "0x2696efe5"
    }   
    response : 
    "storeID": {
        "type": "BigNumber",
        "hex": "0x00"
    }  
```

**`/submit-receipt-v1`**

Submits 

```javascript
    params : 
    {
    "storeKey" : "store1",
    "storeSignal" : 0,
    "chainId"  : "0x2696efe5",
    "country" : "Malaysia",
    "storeName" : "My first store",
    "buyerAddr" : "0x123123123", // optional, leave empty users need to be veriried. 
    "transactionSummary" : "Food Sales",
    "receiptData" : {
        "items" : [
            {
            "detail" : "banana",
            "qty" : 1,
            "price": "24"
            },
            {
            "detail" : "apple",
            "qty" : 5,
            "price": "20"
            },
            {
            "detail" : "strawberry",
            "qty" : 10,
            "price": "100"
            }
        ],
        "total" : "144",
        "buyer" : "Carlos",
        "store" : "store1",
        "currency" : "MYR"
        }
    }    
    response : 
    {
    "web3.storage cid:": "bafybeihtindlw7rsucrsp6uri4di5grepypt5oimf5pzawxkt4ixm4eqr4"
    }    
```

**`/get-store-transactions`**

Submits 

```javascript
    params : 
    {
        "storeKey" : "store1",
        "storeSignal" : 0
    }
    response : 
    {
        "transactions": [
            {
                "id": "0x63c700441d03e865d1aa3a1d948bae41efa1e3beb2bc2eb77a098a6ff72ce85b",
                "StoreNullifier": "6697654036741624836974658011983342132197416885180898960112422935750746252622",
                "ipfsURI": "hola"
            }
        ]
    }
```

**`/get-user-transactions`**

Submits 

```javascript
    params : 
    {
        "buyerAddr" : "store1",
        "storeSignal" : 0
    }
    response : 
    {
        "transactions": [
            {
                "id": "0x63c700441d03e865d1aa3a1d948bae41efa1e3beb2bc2eb77a098a6ff72ce85b",
                "StoreNullifier": "6697654036741624836974658011983342132197416885180898960112422935750746252622",
                "ipfsURI": "hola"
            }
        ]
    }
```