import {
  PublicKey,
  PrivateKey,
  Field,
  Signature,
  MerkleTree,
  MerkleWitness,
} from 'o1js';
import { MarketplaceContract, Asset } from './Marketplacontract.js';

// Define MerkleWitness8 class
class MerkleWitness8 extends MerkleWitness(8) {}

export class MarketplaceInteractions {
  contract: MarketplaceContract;
  merkleTree: MerkleTree;

  constructor(address: PublicKey) {
    this.contract = new MarketplaceContract(address);
    this.merkleTree = new MerkleTree(8);
  }

  async mintAsset(
    owner: PublicKey,
    ownerKey: PrivateKey,
    contentHash: Field,
    index: bigint
  ) {
    const asset = new Asset({
      owner,
      contentHash,
      price: Field(0),
      forSale: Field(0)
    });

    const witness = new MerkleWitness8(this.merkleTree.getWitness(index));
    const signature = Signature.create(ownerKey, [contentHash]);

    await this.contract.mintAsset(witness, asset, signature);
    this.merkleTree.setLeaf(index, asset.hash());
    
    return asset;
  }

  async listForSale(
    owner: PublicKey,
    ownerKey: PrivateKey,
    contentHash: Field,
    price: Field,
    index: bigint
  ) {
    const asset = new Asset({
      owner,
      contentHash,
      price: Field(0),
      forSale: Field(0)
    });

    const witness = new MerkleWitness8(this.merkleTree.getWitness(index));
    const signature = Signature.create(ownerKey, [contentHash]);

    await this.contract.listForSale(witness, asset, price, signature);
    const updatedAsset = new Asset({
      owner,
      contentHash,
      price,
      forSale: Field(1)
    });

    this.merkleTree.setLeaf(index, updatedAsset.hash());
    return updatedAsset;
  }

  async purchaseAsset(
    currentOwner: PublicKey,
    newOwner: PublicKey,
    newOwnerKey: PrivateKey,
    contentHash: Field,
    price: Field,
    index: bigint
  ) {
    const asset = new Asset({
      owner: currentOwner,
      contentHash,
      price,
      forSale: Field(1)
    });

    const witness = new MerkleWitness8(this.merkleTree.getWitness(index));
    const signature = Signature.create(newOwnerKey, [contentHash, price]);

    await this.contract.purchaseAsset(witness, asset, newOwner, signature);
    const updatedAsset = new Asset({
      owner: newOwner,
      contentHash,
      price: Field(0),
      forSale: Field(0)
    });

    this.merkleTree.setLeaf(index, updatedAsset.hash());
    return updatedAsset;
  }
}