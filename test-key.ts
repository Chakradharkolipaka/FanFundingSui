import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
const kp = new Ed25519Keypair();
console.log("Secret key format:", kp.getSecretKey());
console.log("Length:", kp.getSecretKey().length);
