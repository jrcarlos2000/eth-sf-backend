import {
    Semaphore,
    generateMerkleProof,
    StrBigInt,
    MerkleProof,
    SemaphoreSolidityProof,
} from '@zk-kit/protocols' ;
import { ZkIdentity, Strategy } from '@zk-kit/identity'
import { solidityPack } from  'ethers/lib/utils'
import { ethers } from 'ethers';

export const actionID = "wid_test_1234";


const hashBytes = (signal:any) => {
    return BigInt(ethers.utils.solidityKeccak256(['bytes'], [signal])) >> BigInt(8)
}

export const getProof = async (externalNullifier : any ,signal : any, identityString : any) => {
    const identity = new ZkIdentity(Strategy.MESSAGE, identityString)
    const identityCommitment = identity.genIdentityCommitment()
  
    const witness = generateSemaphoreWitness(
        identity.getTrapdoor(),
        identity.getNullifier(),
        generateMerkleProof(20, BigInt(0), [identityCommitment], identityCommitment),
        hashBytes(solidityPack(['string'], [externalNullifier])),
        // update here if changing the signal (you might need to wrap in a `pack()` call if there are multiple arguments), see above
        signal
    )
  
    const { proof, publicSignals } = await Semaphore.genProof(
        witness,
        './utils/snark-artifacts/semaphore.wasm',
        './utils/snark-artifacts/semaphore_final.zkey'
    )
  
    return [publicSignals.nullifierHash, Semaphore.packToSolidityProof(proof)]
}

const generateSemaphoreWitness = (
  identityTrapdoor: any,
  identityNullifier : any,
  merkleProof : any,
  externalNullifier : any,
  signal : any
) => ({
  identityNullifier: identityNullifier,
  identityTrapdoor: identityTrapdoor,
  treePathIndices: merkleProof.pathIndices,
  treeSiblings: merkleProof.siblings,
  externalNullifier: externalNullifier,
  signalHash: hashBytes(signal),
})