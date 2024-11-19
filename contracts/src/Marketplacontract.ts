import {
    Field,
    SmartContract,
    state,
    State,
    method,
    DeployArgs,
    Permissions,
    PublicKey,
    Signature,
    MerkleWitness,
    Struct,
  } from 'o1js';
  
  class MerkleWitness8 extends MerkleWitness(8) {}
  
  export class Asset extends Struct({
    owner: PublicKey,
    contentHash: Field,
    price: Field,
    forSale: Field,
  }) {
    hash(): Field {
      return this.owner
        .toFields()[0]
        .add(this.contentHash)
        .add(this.price)
        .add(this.forSale);
    }
  }
  
  export class MarketplaceContract extends SmartContract {
    @state(Field) assetsRoot = State<Field>();
    
    async deploy(args: DeployArgs) {
      super.deploy(args);
      this.account.permissions.set({
        ...Permissions.default(),
        editState: Permissions.proofOrSignature(),
      });
    }
  
    @method async mintAsset(witness: MerkleWitness8, asset: Asset, signature: Signature) {
      // Verify the signature is from the owner
      signature.verify(asset.owner, [asset.contentHash]);
      
      // Calculate and update Merkle root
      const newRoot = witness.calculateRoot(asset.hash());
      this.assetsRoot.set(newRoot);
    }
  
    @method async listForSale(
      witness: MerkleWitness8, 
      asset: Asset, 
      newPrice: Field, 
      signature: Signature
    ) {
      // Add state precondition
      const currentRoot = this.assetsRoot.get();
      this.assetsRoot.requireEquals(currentRoot);
  
      // Verify current state
      const calculatedRoot = witness.calculateRoot(asset.hash());
      currentRoot.assertEquals(calculatedRoot);
  
      // Verify ownership
      signature.verify(asset.owner, [asset.contentHash]);
      
      // Create updated asset
      const updatedAsset = new Asset({
        owner: asset.owner,
        contentHash: asset.contentHash,
        price: newPrice,
        forSale: Field(1)
      });
      
      // Update state
      const newRoot = witness.calculateRoot(updatedAsset.hash());
      this.assetsRoot.set(newRoot);
    }
  
    @method async purchaseAsset(
      witness: MerkleWitness8, 
      asset: Asset, 
      newOwner: PublicKey, 
      signature: Signature
    ) {
      // Add state precondition
      const currentRoot = this.assetsRoot.get();
      this.assetsRoot.requireEquals(currentRoot);
  
      // Verify current state
      const calculatedRoot = witness.calculateRoot(asset.hash());
      currentRoot.assertEquals(calculatedRoot);
  
      // Verify asset is for sale
      asset.forSale.assertEquals(Field(1));
  
      // Verify buyer's signature
      signature.verify(newOwner, [asset.contentHash, asset.price]);
      
      // Create updated asset
      const updatedAsset = new Asset({
        owner: newOwner,
        contentHash: asset.contentHash,
        price: Field(0),
        forSale: Field(0)
      });
      
      // Update state
      const newRoot = witness.calculateRoot(updatedAsset.hash());
      this.assetsRoot.set(newRoot);
    }
  }