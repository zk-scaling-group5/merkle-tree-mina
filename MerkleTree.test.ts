import { Field, Poseidon, Bool } from 'o1js';
import { MerkleTree, MerkleTreeWitness } from './MerkleTree';

/**
 * Test suite for the MerkleTree implementation
 * These tests verify essential functionalities of our MerkleTree
 */
describe('MerkleTree', () => {
  // Basic tree creation test
  test('should create an empty tree with correct height', () => {
    // Create a tree of height 3 (8 possible leaves)
    const tree = new MerkleTree(3);
    const root = tree.getRoot();
    // Root of empty tree should be Field(0)
    expect(root.toString()).toBe(Field(0).toString());
  });

  // Leaf insertion and root calculation test
  test('should correctly update root after leaf insertion', () => {
    const tree = new MerkleTree(3);
    const testValue = Field(123);
    
    // Insert a value at index 0
    tree.setLeaf(0, testValue);
    
    // Manual calculation of expected root for verification
    let expectedRoot = testValue;
    for (let i = 0; i < 3; i++) {
      expectedRoot = Poseidon.hash([expectedRoot, Field(0)]);
    }
    
    expect(tree.getRoot().toString()).toBe(expectedRoot.toString());
  });

  // Proof generation and verification test
  test('should generate and verify valid proofs', () => {
    const tree = new MerkleTree(3);
    const testValue = Field(123);
    
    // Insert a value
    tree.setLeaf(0, testValue);
    
    // Generate proof for index 0
    const proof = tree.getProof(0);
    const root = tree.getRoot();
    
    // Verify the proof
    const isValid = MerkleTree.verifyProof(
      testValue,
      proof,
      root,
      0
    );
    
    expect(isValid).toEqual(Bool(true));
  });

  // Invalid proof detection test
  test('should detect invalid proofs', () => {
    const tree = new MerkleTree(3);
    const testValue = Field(123);
    
    tree.setLeaf(0, testValue);
    
    // Generate proof
    const proof = tree.getProof(0);
    const root = tree.getRoot();
    
    // Attempt verification with wrong value
    const isValid = MerkleTree.verifyProof(
      Field(456), // Wrong value
      proof,
      root,
      0
    );
    
    expect(isValid).toEqual(Bool(false));
  });

  // Multiple insertions test
  test('should handle multiple leaf insertions correctly', () => {
    const tree = new MerkleTree(3);
    
    // Insert multiple values
    tree.setLeaf(0, Field(1));
    tree.setLeaf(1, Field(2));
    tree.setLeaf(2, Field(3));
    
    // Generate proofs for each leaf
    const proof0 = tree.getProof(0);
    const proof1 = tree.getProof(1);
    const proof2 = tree.getProof(2);
    
    const root = tree.getRoot();
    
    // Verify all proofs are valid
    expect(MerkleTree.verifyProof(Field(1), proof0, root, 0)).toEqual(Bool(true));
    expect(MerkleTree.verifyProof(Field(2), proof1, root, 1)).toEqual(Bool(true));
    expect(MerkleTree.verifyProof(Field(3), proof2, root, 2)).toEqual(Bool(true));
  });
});