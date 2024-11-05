import {
  Field,
  Poseidon,
  MerkleWitness,
  CircuitString,
  Bool,
} from 'o1js';

/**
 * MerkleTree implementation for Mina Protocol
 * Uses Field elements and Poseidon hashing for compatibility with zero-knowledge proofs
 */
class MerkleTree {
  // Storage for tree nodes
  private tree: Field[];
  // Height of the tree
  private height: number;
  // Total possible number of leaves
  private leafCount: number;

  /**
   * Constructs a new Merkle Tree
   * @param height - Tree height that determines maximum number of leaves (2^height)
   */
  constructor(height: number) {
    this.height = height;
    this.leafCount = 2 ** height;
    // Initialize tree with empty nodes (Field(0))
    this.tree = new Array(2 * this.leafCount).fill(Field(0));
  }

  /**
   * Retrieves the root of the tree
   * @returns The Field value of the root
   */
  getRoot(): Field {
    return this.tree[1];
  }

  /**
   * Converts a leaf index to its position in the tree array
   * @param index - Leaf position
   * @returns Corresponding index in the tree array
   */
  private getLeafIndex(index: number): number {
    return index + this.leafCount;
  }

  /**
   * Updates a leaf and recalculates the path to root
   * @param index - Position of the leaf to update
   * @param value - New value for the leaf
   */
  setLeaf(index: number, value: Field) {
    if (index < 0 || index >= this.leafCount) {
      throw new Error('Leaf index out of bounds');
    }

    let currentIndex = this.getLeafIndex(index);
    this.tree[currentIndex] = value;

    // Recalculate path to root
    while (currentIndex > 1) {
      currentIndex = Math.floor(currentIndex / 2);
      const leftChild = this.tree[2 * currentIndex];
      const rightChild = this.tree[2 * currentIndex + 1];
      // Use Poseidon hash for parent nodes
      this.tree[currentIndex] = Poseidon.hash([leftChild, rightChild]);
    }
  }

  /**
   * Generates a Merkle proof for a given leaf
   * @param index - Position of the leaf
   * @returns Array of hashes forming the proof
   */
  getProof(index: number): Field[] {
    if (index < 0 || index >= this.leafCount) {
      throw new Error('Leaf index out of bounds');
    }

    const proof: Field[] = [];
    let currentIndex = this.getLeafIndex(index);

    // Collect sibling hashes along the path to root
    while (currentIndex > 1) {
      // Get sibling index (if current is left child, get right child and vice versa)
      const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      proof.push(this.tree[siblingIndex]);
      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
  }

  /**
   * Verifies a Merkle proof
   * @param leaf - Value of the leaf
   * @param proof - Array of hashes forming the proof
   * @param root - Root of the tree
   * @param index - Position of the leaf
   * @returns Bool indicating if the proof is valid
   */
  static verifyProof(
    leaf: Field,
    proof: Field[],
    root: Field,
    index: number
  ): Bool {
    let currentHash = leaf;
    let currentIndex = index;

    // Recalculate hash path
    for (let i = 0; i < proof.length; i++) {
      const isLeft = currentIndex % 2 === 0;
      // Arrange inputs based on position (left/right)
      const [leftInput, rightInput] = isLeft
        ? [currentHash, proof[i]]
        : [proof[i], currentHash];
      
      currentHash = Poseidon.hash([leftInput, rightInput]);
      currentIndex = Math.floor(currentIndex / 2);
    }

    // Verify final hash matches root
    return currentHash.equals(root);
  }

  /**
   * Retrieves all leaves of the tree
   * @returns Array of all leaves
   */
  getLeaves(): Field[] {
    return this.tree.slice(this.leafCount, 2 * this.leafCount);
  }
}

/**
 * Witness class for use in ZK proofs
 * Height 8 allows for 256 leaves
 */
class MerkleTreeWitness extends MerkleWitness(8) {}

export { MerkleTree, MerkleTreeWitness };